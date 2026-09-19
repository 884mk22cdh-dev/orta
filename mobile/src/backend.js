// Подключение к Supabase (проект ORTA). Пока ключи не вставлены в
// backend-config.js — BACKEND_ENABLED = false и приложение живёт офлайн.
import 'react-native-url-polyfill/auto';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './backend-config';
import { markOnline, markOffline } from './net';

export const BACKEND_ENABLED = /^https:\/\//.test(SUPABASE_URL);

/**
 * Сервер не ответил. Отличать от null («данных нет») обязательно:
 * иначе сетевой сбой затирает расписание, группу и чат пустотой.
 */
export const FAILED = Symbol('failed');

export const supabase = BACKEND_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Анонимный вход: у каждого устройства — свой аккаунт, без паролей и SMS
let sessionChecked = false;

/** Токен есть, а пользователя за ним уже нет (аккаунт удалён на сервере). */
const deadSession = msg => /sub claim|user_not_found|does not exist|User from sub/i.test(String(msg || ''));

export async function ensureAuth() {
  if (!BACKEND_ENABLED) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      markOnline();
      // Один раз за запуск убеждаемся, что аккаунт за токеном ещё существует.
      // Иначе телефон может бесконечно ходить с мёртвым токеном и получать 403
      // на каждый запрос — включая отправку кода на почту.
      if (!sessionChecked) {
        sessionChecked = true;
        const { error } = await supabase.auth.getUser();
        if (error && deadSession(error.message)) {
          await supabase.auth.signOut().catch(() => {});
          const fresh = await supabase.auth.signInAnonymously();
          return fresh.data?.user || null;
        }
      }
      return session.user;
    }
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    markOnline();
    return data.user;
  } catch (e) {
    markOffline();
    return null; // офлайн-режим, приложение продолжает работать локально
  }
}

/** Сброс мёртвой сессии по требованию — вызывается, когда сервер ответил 403. */
export async function resetDeadSession(err) {
  if (!BACKEND_ENABLED || !deadSession(err)) return false;
  sessionChecked = true;
  await supabase.auth.signOut().catch(() => {});
  const fresh = await supabase.auth.signInAnonymously();
  return !!fresh.data?.user;
}

/* ---------- Профиль ---------- */
export async function pushProfile(profile, setup) {
  const user = await ensureAuth();
  if (!user) return false;
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    first_name: profile.firstName,
    last_name: profile.lastName,
    phone: profile.phone || '',
    city: setup.city || '',
    university: setup.university || '',
    faculty: setup.faculty || '',
    course: setup.course || 1,
    group_name: setup.group || '',
    updated_at: new Date().toISOString(),
  });
  return !error;
}

/* ---------- Расписание ---------- */
export async function pushSchedule(schedule) {
  const user = await ensureAuth();
  if (!user) return false;
  const rows = [];
  schedule.forEach((day, di) => day.forEach(l => rows.push({
    user_id: user.id, day: di,
    start_time: l.start, end_time: l.end,
    name: l.name, room: l.room || '', teacher: l.teacher || '',
    color: l.color, type: l.type || 'Лекция', cancelled: !!l.cancelled,
  })));
  // Пустое локальное расписание не должно стирать облачное: это бывает при
  // холодном старте, когда с сервера ещё ничего не подтянулось.
  if (!rows.length) return true;
  const del = await supabase.from('lessons').delete().eq('user_id', user.id);
  if (del.error) return false;
  const { error } = await supabase.from('lessons').insert(rows);
  return !error;
}

export async function pullSchedule() {
  const user = await ensureAuth();
  if (!user) return FAILED;
  const { data, error } = await supabase.from('lessons').select('*').eq('user_id', user.id);
  if (error) { markOffline(); return FAILED; }   // сеть/сервер — трогать локальное нельзя
  if (!data?.length) return null;    // расписания просто нет
  return rowsToSchedule(data);
}

function rowsToSchedule(rows) {
  const schedule = [[], [], [], [], [], []];
  rows.forEach(r => {
    schedule[r.day]?.push({
      id: r.id, start: r.start_time, end: r.end_time, name: r.name,
      room: r.room, teacher: r.teacher,
      tInitials: (r.teacher || 'П').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      color: r.color, type: r.type,
      tag: r.type === 'Лекция' ? null : (r.type === 'Лабораторная' ? 'Лаба' : r.type),
      cancelled: r.cancelled, building: '—', icon: 'book-open',
    });
  });
  schedule.forEach(day => day.sort((a, b) => a.start.localeCompare(b.start)));
  return schedule;
}

/* ---------- Форум группы (общий между студентами) ---------- */
const groupKey = (setup, group) => (group && group.code) ? group.code : `${setup.university || ''}|${setup.group || ''}`;

export async function fetchForum(setup, group) {
  const user = await ensureAuth();
  if (!user) return FAILED;
  const { data, error } = await supabase
    .from('forum_posts').select('*')
    .eq('group_key', groupKey(setup, group))
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) { markOffline(); return FAILED; }   // не затираем чат пустотой при сбое
  return data.slice().reverse().map(r => ({
    id: r.id, author: r.author, text: r.body,
    when: new Date(r.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    mine: r.user_id === user.id,
  }));
}

export async function sendForumPost(setup, group, author, text) {
  const user = await ensureAuth();
  if (!user) return false;
  const { error } = await supabase.from('forum_posts').insert({
    group_key: groupKey(setup, group), user_id: user.id, author, body: text,
  });
  return !error;
}

/* ---------- Афиша (общие события вуза + свои) ---------- */
export async function fetchEvents() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: true });
  if (error) return null;
  return data.map(r => ({
    id: r.id, title: r.title, date: r.date_text, place: r.place,
    color: r.color, icon: r.icon, custom: r.user_id === user.id,
    university: r.university || '', official: r.user_id === null, authorId: r.user_id || null,
    photos: Array.isArray(r.photos) ? r.photos : [],
    description: r.description || '',
  }));
}

export async function addEventServer(ev) {
  const user = await ensureAuth();
  if (!user) return false;
  // Событие студента видит весь его университет (RLS сверяет university с профилем)
  const { error } = await supabase.from('events').insert({
    user_id: user.id, title: ev.title, date_text: ev.date, place: ev.place,
    color: ev.color, icon: ev.icon, university: ev.university || null,
  });
  return !error;
}

export async function deleteEventServer(id) {
  const user = await ensureAuth();
  if (!user) return false;
  const { error } = await supabase.from('events').delete().eq('id', id);
  return !error;
}

export function myUserId() {
  return supabase?.auth?.getSession
    ? supabase.auth.getSession().then(({ data }) => data?.session?.user?.id || null)
    : Promise.resolve(null);
}

export async function deleteForumPostServer(id) {
  const user = await ensureAuth();
  if (!user) return false;
  const { error } = await supabase.from('forum_posts').delete().eq('id', id);
  return !error;
}

/* ---------- Группы: староста делится постоянным кодом ---------- */
export async function createGroup(name, university) {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('create_group', { g_name: name, g_university: university });
  return error ? null : data;
}

/** Вступление. Возвращает группу либо { error: 'not_found' | 'course_mismatch' } с курсами. */
export async function joinGroup(code) {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('join_group', { g_code: code });
  return error ? null : data;
}

/* ---------- Преподаватель ---------- */
export async function becomeTeacher(first, last) {
  const user = await ensureAuth();
  if (!user) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.rpc('become_teacher', { t_first: first || '', t_last: last || '' });
  if (error) return { error: error.message };
  return data;
}

export async function myRole() {
  const user = await ensureAuth();
  if (!user) return 'student';
  const { data, error } = await supabase.rpc('my_role');
  return error ? 'student' : (data?.role || 'student');
}

/** Открыть отметку: возвращает код для QR и срок жизни. */
export async function openAttendSession(subject, room, minutes) {
  const user = await ensureAuth();
  if (!user) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.rpc('open_attend_session',
    { s_subject: subject || '', s_room: room || '', s_minutes: Number(minutes) || 10 });
  if (error) return { error: error.message };
  return data;
}

/** Студент отсканировал QR преподавателя. */
export async function markByCode(code) {
  const user = await ensureAuth();
  if (!user) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.rpc('mark_by_code', { s_code: code });
  if (error) return { error: error.message };
  return data;
}

/** Отметить студента вручную: 'present' | 'late' | 'absent' | null (снять). */
export async function setMark(sessionId, studentId, status) {
  const user = await ensureAuth();
  if (!user) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.rpc('set_mark',
    { s_session: sessionId, s_student: studentId, s_status: status });
  if (error) return { error: error.message };
  return data;
}

/** Полный список: все, кого преподаватель вёл по предмету, + отметки этой пары. */
export async function sessionRoster(id) {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('session_roster', { s_id: id });
  if (error || data?.error) return null;
  return data;
}

/** Кто уже отметился — для живого списка на экране преподавателя. */
export async function sessionMarks(id) {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('session_marks', { s_id: id });
  return error ? null : data;
}

export async function mySessions() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('my_sessions');
  return error ? null : data;
}

// Сводка для профиля преподавателя: пары, студенты, отметки, оценки, разбивка по предметам
export async function teacherStats() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('teacher_stats');
  return error || !data?.ok ? null : data;
}

// Все студенты преподавателя — с группой, посещаемостью и числом оценок
export async function myStudents() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('my_students');
  return error || !data?.ok ? null : (data.students || []);
}

// Карточка одного студента: его отметки и оценки у этого преподавателя
export async function studentCard(studentId) {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('student_card', { s_student: studentId });
  return error || !data?.ok ? null : data;
}

// Оценка из карточки студента — предмет указывает сам преподаватель
export async function gradeStudent(studentId, subject, value, comment) {
  const user = await ensureAuth();
  if (!user) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.rpc('grade_student',
    { g_student: studentId, g_subject: subject || '', g_value: value, g_comment: comment || '' });
  if (error) return { error: error.message };
  return data;
}

// Убрать студента из своего списка. Мягко: его отметки и оценки остаются,
// студент по-прежнему видит их у себя — просто у преподавателя он не показывается.
export async function excludeStudent(studentId) {
  const user = await ensureAuth();
  if (!user) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.rpc('exclude_student', { s_student: studentId });
  return error ? { error: error.message } : data;
}

export async function includeStudent(studentId) {
  const user = await ensureAuth();
  if (!user) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.rpc('include_student', { s_student: studentId });
  return error ? { error: error.message } : data;
}

export async function excludedStudents() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('excluded_students');
  return error || !data?.ok ? null : (data.students || []);
}

// Оценка и пара удаляются насовсем — их ставил сам преподаватель
export async function deleteGrade(id) {
  const user = await ensureAuth();
  if (!user) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.rpc('delete_grade', { g_id: id });
  return error ? { error: error.message } : data;
}

export async function deleteSession(id) {
  const user = await ensureAuth();
  if (!user) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.rpc('delete_session', { s_id: id });
  return error ? { error: error.message } : data;
}

// Отчёты: посещаемость по группам, по предметам и по парам
export async function teacherReport() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('teacher_report');
  return error || !data?.ok ? null : data;
}

export async function giveGrade(studentId, subject, value, comment) {
  const user = await ensureAuth();
  if (!user) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.rpc('give_grade',
    { g_student: studentId, g_subject: subject || '', g_value: value, g_comment: comment || '' });
  if (error) return { error: error.message };
  return data;
}

export async function myGrades() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('my_grades');
  return error ? null : (data?.grades || []);
}

export async function myTeacherMarks() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('my_teacher_marks');
  return error ? null : (data?.marks || []);
}

/* ---------- ДЗ и материалы от старосты на всю группу ---------- */
export async function fetchGroupTasks() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('my_group_tasks');
  if (error) return null;
  return (data || []).map(r => ({
    id: r.id, title: r.title, subject: r.subject, due: r.due,
    note: r.note, photos: r.photos || [], createdAt: r.created_at,
  }));
}

export async function addGroupTask({ title, subject, due, note, photos }) {
  const user = await ensureAuth();
  if (!user) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.rpc('add_group_task', {
    t_title: title, t_subject: subject || '', t_due: due || '',
    t_note: note || '', t_photos: photos || [],
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { task: { id: data.id, title: data.title, subject: data.subject, due: data.due, note: data.note, photos: data.photos || [], createdAt: data.created_at } };
}

export async function deleteGroupTask(id) {
  const user = await ensureAuth();
  if (!user) return false;
  const { error } = await supabase.from('group_tasks').delete().eq('id', id);
  return !error;
}

/** Переименовать свою группу (может только староста). */
export async function renameGroup(name) {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('rename_group', { g_name: name });
  return error ? null : data;
}

/** Курс старосты изменился — двигаем за ним курс группы. */
export async function setGroupCourse(course) {
  const user = await ensureAuth();
  if (!user) return false;
  const { error } = await supabase.rpc('set_group_course', { g_course: Number(course) || 0 });
  return !error;
}

export async function myGroup() {
  const user = await ensureAuth();
  if (!user) return FAILED;
  const { data, error } = await supabase.rpc('my_group');
  if (error) return FAILED;   // иначе сбой сети молча выкидывает из группы
  return data;
}

export async function leaveGroupServer() {
  const user = await ensureAuth();
  if (!user) return false;
  const { error } = await supabase.rpc('leave_group');
  return !error;
}

export async function getGroupSchedule() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('get_group_schedule');
  if (error || !data?.length) return null;
  return rowsToSchedule(data);
}

export async function getPublicProfile(uid) {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('get_public_profile', { target: uid });
  return error ? null : data;
}

/* ---------- ИИ через Edge Function (ключ Anthropic живёт на сервере) ---------- */
export async function askAI(question, context) {
  const user = await ensureAuth();
  if (!user) return null;
  try {
    const { data, error } = await supabase.functions.invoke('ai', { body: { question, context } });
    if (error || !data || !data.text) return null;
    return String(data.text);
  } catch (e) {
    return null;
  }
}

/* ---------- Вход по коду из письма (вход со второго телефона) ---------- */

/** Из «you can only request this after 24 seconds» достаём число секунд. */
function retryAfterSec(msg) {
  const m = String(msg || '').match(/after (\d+) second/i);
  return m ? Number(m[1]) : null;
}

/**
 * Привязать почту к текущему (анонимному) аккаунту — регистрация в конце онбординга.
 * Именно привязка, а не новый вход: id пользователя сохраняется, вместе с ним
 * остаются расписание, группа, монеты и посещаемость.
 */
export async function attachEmail(email) {
  if (!BACKEND_ENABLED) return { error: 'Нет соединения с сервером' };
  let user = await ensureAuth();
  if (!user) return { error: 'Нет соединения с сервером' };
  // Привязывать почту можно только к анонимному аккаунту. Если в сессии уже
  // полноценный аккаунт с другой почтой, а человек регистрируется заново —
  // это новый человек (или тот же с другого адреса), а не смена почты у старого.
  // Иначе чужая почта перепишет чужой аккаунт вместе с правами.
  if (!user.is_anonymous && user.email && user.email.toLowerCase() !== String(email).toLowerCase()) {
    await supabase.auth.signOut().catch(() => {});
    const { data, error: e0 } = await supabase.auth.signInAnonymously();
    if (e0 || !data?.user) return { error: 'Нет соединения с сервером' };
    user = data.user;
  }
  let { error } = await supabase.auth.updateUser({ email });
  // Аккаунт за токеном мог исчезнуть — берём новый и повторяем
  if (error && await resetDeadSession(error.message)) {
    ({ error } = await supabase.auth.updateUser({ email }));
  }
  if (error) {
    const m = String(error.message || '');
    if (/already|registered|exists/i.test(m)) return { error: 'taken' };
    const wait = retryAfterSec(m);
    if (wait) return { error: `Подождите ${wait} с`, retryAfter: wait };
    if (/rate|too many/i.test(m)) return { error: 'Слишком часто. Подождите немного' };
    if (/invalid|valid email/i.test(m)) return { error: 'Проверьте адрес почты' };
    return { error: m };
  }
  return { ok: true };
}

/** Подтвердить код привязки почты. */
export async function verifyAttachedEmail(email, token) {
  if (!BACKEND_ENABLED) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email_change' });
  if (error) {
    const m = String(error.message || '');
    if (/expired/i.test(m)) return { error: 'Код истёк — запросите новый' };
    if (/invalid|token/i.test(m)) return { error: 'Неверный код' };
    return { error: m };
  }
  return { user: data.user };
}

/** Задать пароль текущему аккаунту — чтобы дальше входить без письма. */
export async function setPassword(password) {
  if (!BACKEND_ENABLED) return { error: 'Нет соединения с сервером' };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const m = String(error.message || '');
    if (/at least|short|6 char/i.test(m)) return { error: 'Пароль минимум 6 символов' };
    if (/same|different from the old/i.test(m)) return { error: 'Придумайте пароль, отличный от прежнего' };
    return { error: m };
  }
  return { ok: true };
}

/** Вход по почте и паролю — обычный путь на втором телефоне. */
export async function signInPassword(email, password) {
  if (!BACKEND_ENABLED) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const m = String(error.message || '');
    if (/invalid login|credentials/i.test(m)) return { error: 'Неверная почта или пароль' };
    if (/not confirmed/i.test(m)) return { error: 'Почта не подтверждена — войдите по коду' };
    return { error: m };
  }
  return { user: data.user };
}

/** Почта, привязанная к аккаунту (её показываем в настройках). */
export async function myEmail() {
  if (!BACKEND_ENABLED) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.email || null;
}

/** Отправить 6-значный код на почту. Аккаунт создаётся сам, если его ещё нет. */
export async function sendEmailCode(email) {
  if (!BACKEND_ENABLED) return { error: 'Нет соединения с сервером' };
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    const m = String(error.message || '');
    const wait = retryAfterSec(m);
    if (wait) return { error: `Подождите ${wait} с`, retryAfter: wait };
    if (/rate|too many/i.test(m)) return { error: 'Слишком часто. Подождите немного' };
    if (/invalid|valid email/i.test(m)) return { error: 'Проверьте адрес почты' };
    return { error: m };
  }
  return { ok: true };
}

/**
 * Проверить код. Проверку делает Supabase на сервере: подходит только
 * настоящий код и только пока он не истёк — подобрать или ввести любой нельзя.
 */
export async function verifyEmailCode(email, token) {
  if (!BACKEND_ENABLED) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) {
    const m = String(error.message || '');
    if (/expired/i.test(m)) return { error: 'Код истёк — запросите новый' };
    if (/invalid|token/i.test(m)) return { error: 'Неверный код' };
    return { error: m };
  }
  return { user: data.user };
}

export async function fetchMyProfile() {
  if (!BACKEND_ENABLED) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  return data || null;
}

/* ---------- Пуш-уведомления и фото афиши ---------- */
export async function savePushToken(token) {
  const user = await ensureAuth();
  if (!user || !token) return false;
  const { error } = await supabase.from('push_tokens')
    .upsert({ user_id: user.id, token, updated_at: new Date().toISOString() });
  return !error;
}

export async function fetchPushTokens() {
  const user = await ensureAuth();
  if (!user) return [];
  const { data, error } = await supabase.from('push_tokens').select('token');
  if (error) return [];
  return [...new Set((data || []).map(r => r.token).filter(Boolean))];
}

/* Отправка пуша через сервис Expo (без своего сервера) */
export async function sendPushToAll(title, body) {
  const tokens = await fetchPushTokens();
  if (!tokens.length) return 0;
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 90) chunks.push(tokens.slice(i, i + 90));
  let sent = 0;
  for (const chunk of chunks) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
        body: JSON.stringify(chunk.map(to => ({ to, sound: 'default', title, body, priority: 'high' }))),
      });
      sent += chunk.length;
    } catch (e) {}
  }
  return sent;
}

/* Загрузка фото афиши в хранилище, возвращает публичную ссылку */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(b64) {
  const clean = String(b64).replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array((clean.length * 3) >> 2);
  let p = 0, buf = 0, bits = 0;
  for (let i = 0; i < clean.length; i++) {
    buf = (buf << 6) | B64.indexOf(clean[i]);
    bits += 6;
    if (bits >= 8) { bits -= 8; bytes[p++] = (buf >> bits) & 0xff; }
  }
  return bytes.subarray(0, p);
}

export async function uploadEventPhoto(uri) {
  const user = await ensureAuth();
  if (!user) return { url: null, error: 'нет входа' };
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const bytes = base64ToBytes(b64);
    if (!bytes.length) return { url: null, error: 'файл пустой' };
    const name = `afisha/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from('files').upload(name, bytes, {
      contentType: 'image/jpeg', upsert: false,
    });
    if (error) return { url: null, error: error.message || String(error) };
    const { data } = supabase.storage.from('files').getPublicUrl(name);
    return { url: data?.publicUrl || null, error: data?.publicUrl ? null : 'нет ссылки' };
  } catch (e) {
    return { url: null, error: String(e && e.message ? e.message : e).slice(0, 80) };
  }
}

/* ---------- ORTA Coin (баланс на сервере) ---------- */
export async function coinsState() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('my_coins');
  return error ? null : data;
}

export async function coinsClaimDaily() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('claim_daily');
  return error ? null : data;
}

export async function coinsClaimTask(taskId) {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('claim_task', { task_id: String(taskId) });
  return error ? null : data;
}

export async function coinsClaimReferral(inviterId) {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('claim_referral', { inviter: inviterId });
  return error ? null : data;
}

export async function coinsClaimOwnerBonus() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('claim_owner_bonus');
  return error ? null : data;
}

/* ---------- Админ (CRM внутри приложения) ---------- */
export async function adminGetSchedule(userId) {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.from('lessons').select('*').eq('user_id', userId);
  if (error) return null;
  return rowsToSchedule(data || []);
}

export async function adminCheck() {
  const user = await ensureAuth();
  if (!user) return false;
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

export async function adminLoad() {
  const user = await ensureAuth();
  if (!user) return null;
  const cnt = async tbl => {
    const { count } = await supabase.from(tbl).select('*', { count: 'exact', head: true });
    return count ?? 0;
  };
  const [users, groups, posts, events] = await Promise.all([
    cnt('profiles'), cnt('groups'), cnt('forum_posts'), cnt('events'),
  ]);
  const [{ data: profiles }, { data: groupRows }, { data: postRows }, { data: eventRows }] = await Promise.all([
    supabase.from('profiles').select('*').order('updated_at', { ascending: false }).limit(15),
    supabase.from('groups').select('*').order('created_at', { ascending: false }).limit(15),
    supabase.from('forum_posts').select('*').order('created_at', { ascending: false }).limit(15),
    supabase.from('events').select('*').order('created_at', { ascending: false }).limit(30),
  ]);
  return {
    stats: { users, groups, posts, events },
    profiles: profiles || [], groups: groupRows || [], posts: postRows || [], events: eventRows || [],
  };
}

export async function adminPublishEvent(ev) {
  const user = await ensureAuth();
  if (!user) return { ok: false, error: 'нет соединения' };
  const { error } = await supabase.from('events').insert({
    user_id: null, title: ev.title, date_text: ev.date, place: ev.place,
    color: ev.color, icon: ev.icon, photos: ev.photos || [], description: ev.description || '',
  });
  return { ok: !error, error: error ? (error.message || String(error)) : null };
}

export async function adminDeleteEvent(id) {
  const user = await ensureAuth();
  if (!user) return false;
  const { error } = await supabase.from('events').delete().eq('id', id);
  return !error;
}

/* ---------- DOSS: реальный обмен расписанием по коду ---------- */
export async function createShareCode() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('create_share_code');
  return error ? null : data;
}

export async function importScheduleByCode(code) {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('get_shared_schedule', { share_code: code });
  if (error || !data?.length) return null;
  return rowsToSchedule(data);
}

/* ---------- Отчёты о падениях ---------- */
// Отправляем даже без входа: аноним тоже может упасть, и это надо знать.
export async function reportCrash({ message, stack, screen, version, platform, fatal }) {
  try {
    await supabase.rpc('report_crash', {
      c_message: message, c_stack: stack, c_screen: screen,
      c_version: version, c_platform: platform, c_fatal: fatal,
    });
  } catch {
    // молча: отчёт о падении не должен ронять приложение
  }
}

export async function crashList() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('crash_list');
  return error || !data?.ok ? null : (data.crashes || []);
}

// Удаление аккаунта из приложения — требование App Store 5.1.1(v).
// Удаляет и данные на сервере, и саму запись входа: вернуться нельзя.
export async function deleteMyAccount() {
  const user = await ensureAuth();
  if (!user) return { error: 'Нет соединения с сервером' };
  const { data, error } = await supabase.rpc('delete_my_account');
  if (error) return { error: error.message };
  if (data?.ok) await supabase.auth.signOut().catch(() => {});
  return data;
}

/* ---------- Минимальная версия приложения ----------
   Таблица app_config читается без входа. Если версия на телефоне ниже
   min_version — приложение показывает экран «Обновите ORTA» и дальше не пускает. */
export async function fetchAppConfig() {
  try {
    const { data, error } = await supabase.from('app_config').select('*').eq('id', 'ios').maybeSingle();
    if (error || !data) return null;
    return { minVersion: data.min_version || '', latestVersion: data.latest_version || '', storeUrl: data.store_url || '', message: data.message || '' };
  } catch (e) { return null; }
}

/* ---------- Админ: все студенты с почтой и активностью (только admin, проверка на сервере) ---------- */
export async function adminStudents(search = '') {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('admin_students', { search: String(search || ''), lim: 500 });
  if (error) return null;
  return (data || []).map(r => ({
    id: r.id, email: r.email, first_name: r.first_name || '', last_name: r.last_name || '', phone: r.phone || '',
    university: r.university || '', faculty: r.faculty || '', course: r.course, group_name: r.group_name || '',
    role: r.role || 'student', created_at: r.created_at, last_sign_in_at: r.last_sign_in_at, seen_at: r.seen_at, app_version: r.app_version || '',
    lessons: r.lessons || 0, in_group: !!r.in_group, coins: r.coins || 0, streak: r.streak || 0, push: !!r.push,
  }));
}

export async function adminSummary() {
  const user = await ensureAuth();
  if (!user) return null;
  const { data, error } = await supabase.rpc('admin_summary');
  return error ? null : data;
}

/* Присутствие: раз в минуту, пока приложение открыто. Админ видит «в сети». */
export async function touchPresence(version) {
  try {
    const user = await ensureAuth();
    if (!user || user.is_anonymous) return;
    await supabase.rpc('touch_presence', { app_version: String(version || '') });
  } catch (e) {}
}
