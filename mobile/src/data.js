import { C } from './theme';
import { now as tzNow, nowMinutes, today as tzToday } from './time';

export const DEFAULT_STATE = {
  onboarded: false,
  setup: { city: 'Алматы', university: 'КазНУ им. аль-Фараби', faculty: 'Информационных технологий', course: 2, group: '', eduKind: 'uni', role: 'student' },
  profile: { firstName: 'Илон', lastName: 'Маск', initials: 'ИМ', phone: '', email: '' },
  chips: 'subjects',
  showAllSubjects: false,
  bookmarks: [],
  notifChangesOn: true,
  remindBefore: 15,
  lastSync: null,
  readNotifs: ['n4'],
  subjects: [
    { id: 'math', name: 'Математика', color: C.purple, icon: 'calculator', time: '09:00', tInitials: 'АС', tShort: 'Айгүль С.', tFull: 'Айгүль Сериковна' },
    { id: 'hist', name: 'История Казахстана', color: C.red, icon: 'landmark', time: '11:00', tInitials: 'ДН', tShort: 'Дана Н.', tFull: 'Дана Нұрланқызы' },
    { id: 'phys', name: 'Физика', color: C.yellow, icon: 'atom', time: '13:00', tInitials: 'ЕМ', tShort: 'Ерлан М.', tFull: 'Ерлан Мұратұлы' },
    { id: 'eng', name: 'Английский язык', color: C.green, icon: 'languages', time: '15:00', tInitials: 'АЖ', tShort: 'Асель Ж.', tFull: 'Асель Жанатқызы' },
    { id: 'chem', name: 'Химия', color: C.teal, icon: 'flask-conical', time: '10:40', tInitials: 'ГӘ', tShort: 'Гүлнара Ә.', tFull: 'Гүлнара Әбенова' },
    { id: 'prog', name: 'Программирование', color: C.blue, icon: 'code', time: '12:40', tInitials: 'ТО', tShort: 'Тимур О.', tFull: 'Тимур Оразбаев' },
  ],
  events: [
    { id: 'e1', title: 'Хакатон Astana Hub', date: '5 сентября, 10:00', place: 'IT-корпус, ауд. 220', color: C.purple, icon: 'code' },
    { id: 'e2', title: 'Кубок первокурсника КВН', date: '12 сентября, 18:00', place: 'Актовый зал', color: C.red, icon: 'ticket' },
    { id: 'e3', title: 'Ярмарка вакансий', date: '19 сентября, 11:00', place: 'Главный корпус, холл', color: C.green, icon: 'briefcase' },
  ],
  theme: 'light',
  lang: 'ru',
  isTeacher: false,    // роль решает, какой показывать главный экран
  teacherSessions: [], // пары преподавателя
  grades: [],          // мои оценки (студент)
  teacherMarks: [],    // отметки, поставленные преподавателями на парах
  groupTasks: [],      // ДЗ от старосты — общее на всю группу, приходит с сервера
  groupTaskDone: {},   // кто что сделал — у каждого своё, хранится локально
  attendance: {},   // мой журнал посещаемости: { 'YYYY-MM-DD': { lessonId: {status, name, at} } }
  attendAsk: true,  // спрашивать о посещаемости пушем через 10 минут после начала пары
  lessonData: {},
  privacy: { groupVisible: true, analytics: false },
  tasks: [
    { id: 't1', title: 'Решить задачи 5–12 по матанализу', subject: 'Математика', due: '3 сентября', done: false },
    { id: 't2', title: 'Эссе по истории Казахстана', subject: 'История Казахстана', due: '5 сентября', done: false },
  ],
  group: null,
  coins: 50,
  blocked: [],
  hiddenEvents: [],        // id событий, на которые пожаловались — скрыты у этого пользователя
  blockedEventAuthors: [], // авторы событий, которых пользователь скрыл
  exams: [
    { id: 'x1', subject: 'Математика', date: '12 января', time: '09:00', room: '214', color: C.purple },
    { id: 'x2', subject: 'Физика', date: '16 января', time: '11:00', room: '312', color: C.yellow },
    { id: 'x3', subject: 'Программирование', date: '20 января', time: '09:00', room: '220', color: C.blue },
  ],
  forum: [
    { id: 'f1', author: 'Айым (староста)', text: 'Завтра собрание группы в 14:00, ауд. 305. Приходите все!', when: 'вчера' },
    { id: 'f2', author: 'Дана Н.', text: 'Семинар по истории переносится на пятницу, 09:00.', when: '2 дня назад' },
  ],
};

export const EVENT_ICONS = ['ticket', 'megaphone', 'music', 'code', 'graduation-cap', 'dumbbell', 'palette', 'briefcase'];

/* Расписание по дням недели: 0=Пн … 5=Сб (воскресенье — пар нет) */
export const DEFAULT_SCHEDULE = [
  [
    { id: 'mon1', start: '09:00', end: '09:50', name: 'Математика', room: '214', teacher: 'Айгүль Сериковна', tInitials: 'АС', color: C.purple, type: 'Лекция', tag: null, building: 'Главный, А', icon: 'calculator', badge: '∫x' },
    { id: 'mon2', start: '10:40', end: '12:10', name: 'Английский язык', room: '118', teacher: 'Асель Жанатқызы', tInitials: 'АЖ', color: C.green, type: 'Практика', tag: 'Практика', building: 'Главный, Б', icon: 'languages' },
    { id: 'mon3', start: '13:00', end: '14:30', name: 'История Казахстана', room: '305', teacher: 'Дана Нұрланқызы', tInitials: 'ДН', color: C.red, type: 'Лекция', tag: null, building: 'Главный, А', icon: 'landmark' },
  ],
  [
    { id: 'tue1', start: '08:00', end: '08:50', name: 'Математика', room: '214', teacher: 'Айгүль Сериковна', tInitials: 'АС', color: C.purple, type: 'Лекция', tag: null, building: 'Главный, А', icon: 'calculator', badge: '∫x' },
    { id: 'tue2', start: '09:00', end: '10:30', name: 'Физика', room: '312', teacher: 'Ерлан Мұратұлы', tInitials: 'ЕМ', color: C.blue, type: 'Практика', tag: 'Практика', building: 'Главный, В', icon: 'atom' },
    { id: 'tue3', start: '10:40', end: '12:10', name: 'Химия', room: '401', teacher: 'Гүлнара Әбенова', tInitials: 'ГӘ', color: C.teal, type: 'Лабораторная', tag: 'Лаба', building: 'Химический корпус', icon: 'flask-conical' },
    { id: 'tue4', start: '12:40', end: '14:10', name: 'Программирование', room: '220', teacher: 'Тимур Оразбаев', tInitials: 'ТО', color: C.green, type: 'Практика', tag: 'Практика', building: 'IT-корпус', icon: 'code' },
  ],
  [
    { id: 'wed1', start: '09:00', end: '10:30', name: 'Программирование', room: '220', teacher: 'Тимур Оразбаев', tInitials: 'ТО', color: C.blue, type: 'Лекция', tag: null, building: 'IT-корпус', icon: 'code' },
    { id: 'wed2', start: '10:40', end: '12:10', name: 'Математика', room: '214', teacher: 'Айгүль Сериковна', tInitials: 'АС', color: C.purple, type: 'Практика', tag: 'Практика', building: 'Главный, А', icon: 'calculator', badge: '∫x' },
    { id: 'wed3', start: '12:40', end: '14:10', name: 'Английский язык', room: '118', teacher: 'Асель Жанатқызы', tInitials: 'АЖ', color: C.green, type: 'Практика', tag: 'Практика', building: 'Главный, Б', icon: 'languages' },
    { id: 'wed4', start: '14:20', end: '15:50', name: 'Физика', room: '312', teacher: 'Ерлан Мұратұлы', tInitials: 'ЕМ', color: C.yellow, type: 'Лекция', tag: null, building: 'Главный, В', icon: 'atom' },
  ],
  [
    { id: 'thu1', start: '08:00', end: '08:50', name: 'Математика', room: '214', teacher: 'Айгүль Сериковна', tInitials: 'АС', color: C.purple, type: 'Лекция', tag: null, building: 'Главный, А', icon: 'calculator', badge: '∫x' },
    { id: 'thu2', start: '09:00', end: '10:30', name: 'Физика', room: '312', teacher: 'Ерлан Мұратұлы', tInitials: 'ЕМ', color: C.blue, type: 'Практика', tag: 'Отменена', cancelled: true, building: 'Главный, В', icon: 'atom' },
    { id: 'thu3', start: '10:40', end: '12:10', name: 'Химия', room: '401', teacher: 'Гүлнара Әбенова', tInitials: 'ГӘ', color: C.teal, type: 'Лабораторная', tag: 'Лаба', building: 'Химический корпус', icon: 'flask-conical' },
    { id: 'thu4', start: '12:40', end: '14:10', name: 'Программирование', room: '220', teacher: 'Тимур Оразбаев', tInitials: 'ТО', color: C.green, type: 'Практика', tag: 'Практика', building: 'IT-корпус', icon: 'code' },
  ],
  [
    { id: 'fri1', start: '09:00', end: '10:30', name: 'История Казахстана', room: '305', teacher: 'Дана Нұрланқызы', tInitials: 'ДН', color: C.red, type: 'Семинар', tag: 'Семинар', building: 'Главный, А', icon: 'landmark' },
    { id: 'fri2', start: '10:40', end: '12:10', name: 'Математика', room: '214', teacher: 'Айгүль Сериковна', tInitials: 'АС', color: C.purple, type: 'Лекция', tag: null, building: 'Главный, А', icon: 'calculator', badge: '∫x' },
    { id: 'fri3', start: '12:40', end: '14:10', name: 'Английский язык', room: '118', teacher: 'Асель Жанатқызы', tInitials: 'АЖ', color: C.green, type: 'Практика', tag: 'Практика', building: 'Главный, Б', icon: 'languages' },
  ],
  [
    { id: 'sat1', start: '10:00', end: '11:30', name: 'Физика', room: '312', teacher: 'Ерлан Мұратұлы', tInitials: 'ЕМ', color: C.yellow, type: 'Лабораторная', tag: 'Лаба', building: 'Главный, В', icon: 'atom' },
    { id: 'sat2', start: '11:40', end: '13:10', name: 'Программирование', room: '220', teacher: 'Тимур Оразбаев', tInitials: 'ТО', color: C.blue, type: 'Практика', tag: 'Практика', building: 'IT-корпус', icon: 'code' },
  ],
];

// Пустая неделя: с неё начинает новый студент — свои пары он заводит сам
export const EMPTY_SCHEDULE = () => [[], [], [], [], [], []];

// Текущее (редактируемое) расписание — подменяется из сохранённого состояния
export let SCHEDULE = DEFAULT_SCHEDULE;
export function setSchedule(s) { SCHEDULE = s; }
DEFAULT_STATE.schedule = DEFAULT_SCHEDULE;

export const NOTIFS = [
  { id: 'n1', color: C.purple, bg: 'rgba(108,79,224,.08)', icon: 'clock', bold: 'Математика', text: ['Через 15 минут начнётся ', ', ауд. 214'], when: '12 минут назад' },
  { id: 'n2', color: C.red, bg: 'rgba(244,86,78,.08)', icon: 'refresh-cw', text: ['Расписание на четверг обновилось — 2 изменения'], when: '1 час назад' },
  { id: 'n3', color: C.yellow, bg: 'rgba(242,178,62,.10)', icon: 'triangle-alert', text: ['Замена: Физику 09:00 ведёт другой преподаватель'], when: '3 часа назад' },
  { id: 'n4', color: C.purple, bg: '#fff', icon: 'clock', text: ['Напоминание: завтра История Казахстана в 15:00'], when: 'вчера' },
];

export const UNIVERSITIES = ['КазНУ им. аль-Фараби', 'ЕНУ им. Гумилёва', 'КБТУ', 'Astana IT University'];
export const FACULTIES = ['Информационные технологии', 'Экономика и бизнес', 'Юриспруденция', 'Механика и математика'];
export const GROUPS = ['ВТ-201', 'ВТ-202', 'ВТ-203', 'ИС-201'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const PICK_ICONS = ['calculator', 'atom', 'languages', 'landmark', 'flask-conical', 'code', 'book-open', 'music', 'palette', 'dumbbell'];

/* ---------- Утилиты ---------- */
export const mondayIndex = d => (d.getDay() + 6) % 7;
export const clampDay = i => Math.min(i, 5);
export function weekDates() {
  const now = tzNow();
  const mon = new Date(now);
  mon.setDate(now.getDate() - mondayIndex(now));
  return DAY_NAMES.map((name, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return { name, num: d.getDate() };
  });
}
export const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const nowMin = () => nowMinutes();
export const isToday = i => mondayIndex(tzNow()) === i;
export const greeting = () => { const h = tzNow().getHours(); return h < 5 ? 'Доброй ночи,' : h < 12 ? 'Доброе утро,' : h < 18 ? 'Добрый день,' : 'Добрый вечер,'; };
export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
export function findLesson(id) {
  for (const day of SCHEDULE) for (const l of day) if (l.id === id) return l;
  return null;
}

/* Материалы, ДЗ и заметки привязаны к предмету, а не к отдельной паре:
   фото с лекции по математике должно быть видно и на вторничной, и на
   четверговой математике. Ключ — название предмета без регистра. */
export const subjectKey = name => 'subj:' + String(name || '').trim().toLowerCase();

/* Любая пара этого предмета — чтобы показать цвет и название в списке заметок */
export function findLessonBySubject(key) {
  for (const day of SCHEDULE) for (const l of day) if (subjectKey(l.name) === key) return l;
  return null;
}

/* Данные по предмету + то, что раньше сохранили на конкретную пару */
export function lessonFields(lessonData, lesson) {
  const ld = lessonData || {};
  return { ...(ld[lesson.id] || {}), ...(ld[subjectKey(lesson.name)] || {}) };
}

/* «12 января» → ближайшая будущая дата; null, если не распознали */
export function parseRuDate(text) {
  const m = String(text || '').toLowerCase().match(/(\d{1,2})\s+([а-яё]+)/);
  if (!m) return null;
  const mi = MONTHS_GEN.findIndex(x => m[2].startsWith(x.slice(0, 3)));
  if (mi < 0) return null;
  const now = tzNow();
  let d = new Date(now.getFullYear(), mi, Number(m[1]));
  if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    d = new Date(now.getFullYear() + 1, mi, Number(m[1]));
  }
  return d;
}

/* Дней до ближайшего экзамена; null, если дат нет */
export function daysToFirstExam(exams) {
  const today = tzToday();
  let best = null;
  for (const x of exams || []) {
    const d = parseRuDate(x.date);
    if (d && (!best || d < best)) best = d;
  }
  if (!best) return null;
  return Math.round((best - today) / 86400000);
}

/* ---------- Телефон Казахстана: +7 700 700 70 70 ---------- */
export function phoneDigits(v) {
  let s = String(v || '').replace(/^\s*\+7/, '');   // убираем наш префикс «+7»
  s = s.replace(/\D/g, '');
  if (s.length === 11 && (s[0] === '7' || s[0] === '8')) s = s.slice(1); // вставили полный номер
  return s.slice(0, 10);                            // ровно 10 цифр после +7
}

export function formatPhoneKz(v) {
  const d = phoneDigits(v);
  if (!d) return '+7 ';
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
  return '+7 ' + p.join(' ');
}

export const isPhoneValid = v => phoneDigits(v).length === 10;
