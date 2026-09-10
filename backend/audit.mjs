// Сквозной аудит бэкенда ORTA на живом сервере.
//
//   SUPABASE_PAT=sbp_xxx node backend/audit.mjs
//
// Проверяет права, изоляцию аккаунтов и настройки почты реальными вызовами.

import { createClient } from '../mobile/node_modules/@supabase/supabase-js/dist/index.mjs';

const URL = 'https://zqjbvrfpuusemdsurskc.supabase.co';
const PUB = 'sb_publishable_cNklJgCZPeWFHLkvqWUF2Q_4_N92CRI';
const REF = 'zqjbvrfpuusemdsurskc';
const PAT = process.env.SUPABASE_PAT;

const app = () => createClient(URL, PUB, { auth: { persistSession: false, autoRefreshToken: false } });
const H = { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' };
const sql = async q => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,
    { method: 'POST', headers: H, body: JSON.stringify({ query: q }) });
  return r.ok ? JSON.parse(await r.text()) : [{ err: (await r.text()).slice(0, 200) }];
};

let fail = 0, warn = 0;
const ck = (c, m) => { if (!c) fail++; console.log(`${c ? '✅' : '❌'} ${m}`); };
const wk = (c, m) => { if (!c) warn++; console.log(`${c ? '✅' : '⚠️ '} ${m}`); };
const head = t => console.log(`\n── ${t} ──`);

async function person(name, course) {
  const c = app();
  const { data, error } = await c.auth.signInAnonymously();
  if (!data?.user) {
    console.log(`\n❌ не удалось создать тестовый аккаунт «${name}»: ${error?.message || 'ответ без пользователя'}`);
    console.log('   Обычно это лимит анонимных входов. Подождите час либо поднимите');
    console.log('   rate_limit_anonymous_users в настройках Auth.');
    process.exit(1);
  }
  if (course > 0) {
    await c.from('profiles').upsert({ id: data.user.id, first_name: name, last_name: 'Аудит',
      university: 'Аудит-универ', faculty: 'Ф', course, group_name: 'A-' + course });
  }
  return { c, id: data.user.id };
}

/* ───────── СХЕМА ───────── */
head('Безопасность схемы');
if (PAT) {
  const noRls = await sql("select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' and not relrowsecurity");
  ck(!noRls.length, `RLS включён везде${noRls.length ? ' — БЕЗ RLS: ' + noRls.map(r => r.relname) : ''}`);

  const pub = await sql(`select routine_name from information_schema.role_routine_grants
    where routine_schema='public' and grantee='PUBLIC' and routine_name='grant_coins'`);
  ck(!pub.length, 'начисление произвольной суммы закрыто от всех');

  const noPath = await sql(`select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and p.proconfig is null`);
  ck(!noPath.length, `у security-definer функций закреплён search_path${noPath.length ? ' — БЕЗ: ' + noPath.map(r => r.proname) : ''}`);
}

/* ───────── ВХОД ─────────
   Проверяем на своём временном аккаунте, а не на живых почтах пользователя:
   их пароли он меняет из приложения, и аудит от этого падать не должен. */
head('Вход');
let admin = null;
if (PAT) {
  const keys = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, { headers: H })).json();
  const svc = Array.isArray(keys) && keys.find(k => k.name === 'service_role')?.api_key;
  if (svc) admin = createClient(URL, svc, { auth: { persistSession: false } });
}
if (admin) {
  const mail = `audit-${Date.now()}@example.com`, pass = 'orta-audit-2026';
  const made = await admin.auth.admin.createUser({ email: mail, password: pass, email_confirm: true });
  const uid = made.data?.user?.id;
  ck(!!uid, 'временный аккаунт для проверки входа создан');

  const A = app();
  ck(!(await A.auth.signInWithPassword({ email: mail, password: pass })).error, 'вход по почте и паролю');
  ck((await A.rpc('is_admin')).data === false, 'обычный аккаунт не админ');
  ck(!!(await app().auth.signInWithPassword({ email: mail, password: 'неверный' })).error, 'неверный пароль не пускает');
  ck(!!(await app().auth.signInWithPassword({ email: 'нет-' + mail, password: pass })).error, 'несуществующая почта не пускает');
  ck(!(await app().auth.verifyOtp({ email: mail, token: '000000', type: 'email' })).data?.session, 'подобранный код не пускает');
  ck(!(await A.auth.updateUser({ password: 'новый-пароль-2026' })).error, 'пароль меняется из приложения');
  ck(!(await app().auth.signInWithPassword({ email: mail, password: 'новый-пароль-2026' })).error, 'вход новым паролем работает');
  if (uid) await admin.auth.admin.deleteUser(uid);
} else {
  wk(false, 'вход не проверен — нужен SUPABASE_PAT');
}

// админ у нас реально один — сверяем по базе, а не входом
if (PAT) {
  const adm = await sql("select u.email from admins a join auth.users u on u.id=a.user_id");
  ck(adm.length === 1 && adm[0].email === 'oscaraltyn@gmail.com', `админ ровно один: ${adm.map(x => x.email).join(', ')}`);
}

/* ───────── ГРУППЫ ───────── */
head('Группы, курс, ДЗ');
const owner = await person('Староста', 3);
const mate = await person('Свой', 3);
const kid = await person('Первокур', 1);

const { data: g } = await owner.c.rpc('create_group', { g_name: 'АУДИТ-301', g_university: 'Аудит-универ' });
ck(g?.code && g?.course === 3, `группа создана, курс ${g?.course}`);
ck((await kid.c.rpc('join_group', { g_code: g.code })).data?.error === 'course_mismatch', 'чужой курс не пускает');
ck((await mate.c.rpc('join_group', { g_code: g.code })).data?.role === 'member', 'свой курс вступает');
ck((await mate.c.rpc('join_group', { g_code: 'ZZZZZZ' })).data?.error === 'not_found', 'выдуманный код отклоняется');
ck((await owner.c.rpc('rename_group', { g_name: 'АУДИТ' })).data?.name === 'АУДИТ', 'староста переименовывает');
ck(!(await mate.c.rpc('rename_group', { g_name: 'ВЗЛОМ' })).data, 'участник переименовать не может');
ck(!!(await owner.c.rpc('add_group_task', { t_title: 'ДЗ аудита' })).data?.id, 'староста публикует ДЗ');
ck((await mate.c.rpc('my_group_tasks')).data?.length === 1, 'участник видит ДЗ');
ck(((await kid.c.rpc('my_group_tasks')).data || []).length === 0, 'посторонний ДЗ не видит');
ck(((await kid.c.from('group_tasks').select('*')).data || []).length === 0, 'и напрямую через таблицу');
ck((await mate.c.rpc('add_group_task', { t_title: 'взлом' })).data?.error === 'not_owner', 'участник ДЗ не опубликует');

/* ───────── ЧАТ ───────── */
head('Чат группы');
await owner.c.from('forum_posts').insert({ group_key: g.code, user_id: owner.id, author: 'Староста', body: 'аудит' });
ck(((await mate.c.from('forum_posts').select('*').eq('group_key', g.code)).data || []).length >= 1, 'участник читает чат');
ck(((await kid.c.from('forum_posts').select('*').eq('group_key', g.code)).data || []).length === 0, 'посторонний не читает');
ck(!!(await kid.c.from('forum_posts').insert({ group_key: g.code, user_id: kid.id, author: 'Ч', body: 'x' })).error, 'посторонний не пишет');

/* ───────── ПРЕПОДАВАТЕЛЬ ───────── */
head('Преподаватель');
const tch = await person('Преп', 1);
await tch.c.rpc('become_teacher', { t_first: 'Преп', t_last: 'Аудит' });
ck((await tch.c.rpc('my_role')).data?.role === 'teacher', 'роль закрепляется');
await tch.c.from('profiles').upsert({ id: tch.id, first_name: 'Преп', last_name: 'Аудит',
  university: 'У', faculty: 'Ф', course: 1, group_name: '' });
ck((await tch.c.rpc('my_role')).data?.role === 'teacher', 'роль переживает сохранение профиля');

const ses = (await tch.c.rpc('open_attend_session', { s_subject: 'Аудит-предмет', s_room: '1', s_minutes: 5 })).data;
ck(!!ses?.code, 'отметка открыта');
const stA = await person('Студент-А', 2);
ck((await stA.c.rpc('mark_by_code', { s_code: ses.code })).data?.ok, 'студент отметился по коду');
ck((await tch.c.rpc('session_roster', { s_id: ses.id })).data?.roster?.length === 1, 'преподаватель видит список');
ck((await tch.c.rpc('set_mark', { s_session: ses.id, s_student: stA.id, s_status: 'late' })).data?.ok, 'ручная отметка «опоздал»');
ck((await tch.c.rpc('set_mark', { s_session: ses.id, s_student: stA.id, s_status: 'взлом' })).data?.error === 'bad_status', 'левый статус отклоняется');
ck((await stA.c.rpc('set_mark', { s_session: ses.id, s_student: stA.id, s_status: 'present' })).data?.error === 'not_yours', 'студент чужую отметку не поставит');
ck(!!(await tch.c.rpc('give_grade', { g_student: stA.id, g_subject: 'Аудит-предмет', g_value: '5' })).data?.id, 'оценка выставлена');
ck((await stA.c.rpc('my_grades')).data?.grades?.length === 1, 'студент видит свою оценку');
ck((await mate.c.rpc('my_grades')).data?.grades?.length === 0, 'посторонний чужих оценок не видит');
ck((await mate.c.rpc('give_grade', { g_student: mate.id, g_subject: 'X', g_value: '5' })).data?.error === 'not_teacher', 'студент себе оценку не поставит');

// пары независимы: пропуск первой не «чинится» сканом второй
const ses2 = (await tch.c.rpc('open_attend_session', { s_subject: 'Аудит-предмет', s_minutes: 5 })).data;
const stB = await person('Студент-Б', 2);
await stB.c.rpc('mark_by_code', { s_code: ses2.code });
const r1 = (await tch.c.rpc('session_roster', { s_id: ses.id })).data.roster;
ck(!r1.find(x => x.student_id === stB.id)?.status, 'пропуск первой пары остаётся пропуском');

/* ───────── ПРОФИЛЬ, СТУДЕНТЫ И ОТЧЁТЫ ПРЕПОДАВАТЕЛЯ ───────── */
head('Профиль, студенты и отчёты');
const other = await person('Чужой-преп', 1);
await other.c.rpc('become_teacher', { t_first: 'Чужой', t_last: 'Преп' });

const tst = (await tch.c.rpc('teacher_stats')).data;
ck(tst?.ok && tst.sessions === 2, `сводка: пар ${tst?.sessions}`);
ck(tst?.students === 2, `сводка: студентов ${tst?.students}`);
ck(tst?.grades === 1 && tst?.late === 1, 'сводка: оценки и опоздания сходятся');
ck(tst?.subjects?.length === 1, 'сводка: разбивка по предметам');
ck(tst?.recent_grades?.[0]?.student?.includes('Студент-А'), 'сводка: в последних оценках виден студент');

const studs = (await tch.c.rpc('my_students')).data;
ck(studs?.ok && studs.students.length === 2, `мои студенты: ${studs?.students?.length}`);
ck(studs?.students?.find(x => x.student_id === stA.id)?.late === 1, 'у студента учтено опоздание');
ck(studs?.students?.find(x => x.student_id === stA.id)?.grades === 1, 'у студента учтена оценка');

const card = (await tch.c.rpc('student_card', { s_student: stA.id })).data;
ck(card?.ok && card.marks.length === 1 && card.grades.length === 1, 'карточка студента отдаёт отметки и оценки');
ck((await tch.c.rpc('grade_student', { g_student: stA.id, g_subject: 'Аудит-предмет', g_value: '4', g_comment: 'из карточки' })).data?.ok, 'оценка из карточки ставится');
ck((await tch.c.rpc('grade_student', { g_student: stA.id, g_subject: 'X', g_value: '  ', g_comment: '' })).data?.error === 'empty', 'пустая оценка отклоняется');

const rep = (await tch.c.rpc('teacher_report')).data;
ck(rep?.ok && rep.groups?.length >= 1, 'отчёт по группам собирается');
ck(rep?.subjects?.[0]?.sessions === 2, 'отчёт по предметам считает пары');
ck(rep?.sessions?.length === 2, 'отчёт по парам отдаёт список');

// чужой преподаватель не должен видеть ни студентов, ни карточек, ни отчётов
ck((await other.c.rpc('my_students')).data?.students?.length === 0, 'чужой преподаватель видит 0 студентов');
ck((await other.c.rpc('student_card', { s_student: stA.id })).data?.error === 'not_yours', 'чужой не откроет карточку');
ck((await other.c.rpc('grade_student', { g_student: stA.id, g_subject: 'X', g_value: '2', g_comment: '' })).data?.error === 'not_yours', 'чужой не поставит оценку');
ck((await other.c.rpc('teacher_report')).data?.groups?.length === 0, 'чужой не видит чужой отчёт');
ck((await other.c.rpc('teacher_stats')).data?.sessions === 0, 'чужая сводка пустая');
// студенту всё это закрыто
ck((await stA.c.rpc('my_students')).data?.error === 'not_teacher', 'студенту список студентов закрыт');
ck((await stA.c.rpc('teacher_report')).data?.error === 'not_teacher', 'студенту отчёт закрыт');
ck((await stA.c.rpc('teacher_stats')).data?.error === 'not_teacher', 'студенту сводка закрыта');
ck((await stA.c.rpc('student_card', { s_student: stB.id })).data?.error === 'not_teacher', 'студент чужую карточку не откроет');

/* ───────── ИНДЕКСЫ ───────── */
head('Индексы');
const idx = await sql(`select indexdef from pg_indexes where schemaname='public'
  and tablename in ('attend_sessions','attend_marks','grades')`);
// indexdef выглядит так: «... ON public.attend_sessions USING btree (teacher_id, ...)»
const has = (tbl, col) => idx.some(r => r.indexdef.includes(`.${tbl} USING `) && r.indexdef.includes(`(${col}`));
ck(has('attend_sessions', 'teacher_id'), 'attend_sessions: индекс по teacher_id');
ck(has('grades', 'teacher_id'), 'grades: индекс по teacher_id');
ck(has('attend_marks', 'student_id'), 'attend_marks: индекс по student_id');

/* ───────── МОНЕТЫ ───────── */
head('Монеты');
ck(!!(await mate.c.rpc('grant_coins', { u: mate.id, k: 'h', r: 'x', amt: 999999 })).error, 'произвольная сумма недоступна');
let paid = 0;
for (let i = 0; i < 8; i++) if ((await mate.c.rpc('claim_task', { task_id: 'aud-' + i })).data?.ok) paid++;
ck(paid <= 5, `дневной потолок держится: оплачено ${paid} из 8`);
const d1 = await mate.c.rpc('claim_daily'), d2 = await mate.c.rpc('claim_daily');
ck(!(d1.data?.ok && d2.data?.ok), 'ежедневный бонус нельзя взять дважды');

/* ───────── ИЗОЛЯЦИЯ АККАУНТОВ ───────── */
head('Изоляция аккаунтов');
const fresh = await person('Новый', 2);
ck(((await fresh.c.rpc('my_grades')).data?.grades || []).length === 0, 'у нового аккаунта нет чужих оценок');
ck(((await fresh.c.rpc('my_teacher_marks')).data?.marks || []).length === 0, 'нет чужих отметок');
ck(((await fresh.c.from('lessons').select('*').eq('user_id', stA.id)).data || []).length === 0, 'нет чужого расписания');
ck(((await fresh.c.from('profiles').select('*').eq('id', owner.id)).data || []).length === 0, 'нет чужого профиля');
const fc = (await fresh.c.rpc('my_coins')).data?.balance;
ck(typeof fc === 'number' && fc <= 100, `баланс нового аккаунта свой: ${fc}`);
const pubProf = (await fresh.c.rpc('get_public_profile', { target: owner.id })).data;
ck(pubProf && !pubProf.group_code, 'публичный профиль не отдаёт код группы');

/* ───────── ПОЧТА ───────── */
if (PAT) {
  head('Почта');
  const cfg = await (await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, { headers: H })).json();
  ck(cfg.mailer_otp_length === 6, `длина кода ${cfg.mailer_otp_length}`);
  ck(cfg.mailer_otp_exp === 600, `срок кода ${cfg.mailer_otp_exp} с`);
  ck(cfg.smtp_sender_name === 'ORTA TEAM', `отправитель ${cfg.smtp_sender_name}`);
  ck(String(cfg.mailer_templates_magic_link_content || '').includes('{{ .Token }}'), 'письмо входа шлёт код');
  ck(String(cfg.mailer_templates_email_change_content || '').includes('{{ .Token }}'), 'письмо регистрации шлёт код');
  wk(cfg.rate_limit_email_sent >= 100, `лимит писем ${cfg.rate_limit_email_sent}/час`);
  wk(cfg.smtp_max_frequency <= 20, `пауза между письмами ${cfg.smtp_max_frequency} с`);
}

/* ───────── СОСТОЯНИЕ БАЗЫ ───────── */
if (PAT) {
  head('База');
  const anon = (await sql('select count(*)::int n from auth.users where is_anonymous'))[0]?.n;
  const profs = (await sql('select count(*)::int n from profiles'))[0]?.n;
  wk(anon < 60, `анонимных аккаунтов: ${anon}`);
  console.log(`   профилей: ${profs}`);
}

/* уборка */
for (const p of [mate, owner, kid]) { try { await p.c.rpc('leave_group'); } catch (e) {} }

/* ───────── УБОРКА ЗА СОБОЙ ─────────
   Каждый прогон создаёт ~10 анонимных аккаунтов. Раньше они копились:
   к этому моменту в базе их набралось под сотню, и аудит сам же на них
   ругался. Теперь чистим сразу — по своей метке, чужого не трогая. */
head('Уборка');
try {
  const mine = `is_anonymous and (email is null or email = '') and id in (
      select p.id from profiles p
       where p.last_name = 'Аудит' or p.university = 'Аудит-универ')`;
  const before = await sql(`select count(*) n from auth.users where ${mine}`);
  await sql(`delete from auth.users where ${mine}`);
  const left = await sql(`select count(*) n from auth.users where ${mine}`);
  ck(Number(left[0].n) === 0, `тестовые аккаунты убраны: ${before[0].n}`);
} catch (e) {
  wk(false, `уборка не удалась: ${e.message} — почистите вручную`);
}

console.log(`\n${'═'.repeat(46)}`);
console.log(fail ? `❌ ОШИБОК: ${fail}` : '✅ ошибок нет');
if (warn) console.log(`⚠️  замечаний: ${warn}`);
process.exit(fail ? 1 : 0);
