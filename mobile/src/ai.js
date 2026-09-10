// Локальный ИИ-помощник: отвечает на вопросы о расписании по данным приложения
import { SCHEDULE, mondayIndex, toMin, nowMin, plural } from './data';
import { now as tzNow } from './time';

const DAY_WORDS = [
  ['понедельник', ' пн'],
  ['вторник', ' вт'],
  ['среда', 'среду', ' ср'],
  ['четверг', ' чт'],
  ['пятниц', ' пт'],
  ['суббот', ' сб'],
  ['воскресень', ' вс'],
];
const DAY_IN = ['В понедельник', 'Во вторник', 'В среду', 'В четверг', 'В пятницу', 'В субботу'];

const dayLessons = di => (di >= 0 && di <= 5 ? SCHEDULE[di].filter(l => !l.cancelled) : []);

function fmtDay(di) {
  const ls = dayLessons(di);
  if (!ls.length) return 'пар нет — можно отдыхать ☕';
  return `${ls.length} ${plural(ls.length, 'пара', 'пары', 'пар')}:\n` +
    ls.map(l => `•  ${l.start} — ${l.name} (ауд. ${l.room})`).join('\n');
}

export function aiAnswer(qRaw, st) {
  const q = ` ${qRaw.toLowerCase().trim()} `;
  st = st || {};
  const today = mondayIndex(tzNow());

  if (q.includes('следующ') || q.includes('дальше') || q.includes('ближайш')) {
    if (today <= 5) {
      const next = dayLessons(today).find(l => toMin(l.start) > nowMin());
      if (next) return `Следующая пара сегодня: ${next.name} в ${next.start}, ауд. ${next.room} — ведёт ${next.teacher}.`;
    }
    for (let d = today + 1; d <= 5; d++) {
      const ls = dayLessons(d);
      if (ls.length) return `Сегодня пар больше нет. Следующая — ${DAY_IN[d].toLowerCase()}: ${ls[0].name} в ${ls[0].start}, ауд. ${ls[0].room}.`;
    }
    return 'На этой неделе пар больше нет. Хороших выходных! 🎉';
  }
  if (q.includes('сегодня')) {
    return today > 5 ? 'Сегодня воскресенье — пар нет ☕' : `Сегодня ${fmtDay(today)}`;
  }
  if (q.includes('завтра')) {
    const t = (today + 1) % 7;
    return t > 5 ? 'Завтра воскресенье — пар нет ☕' : `Завтра ${fmtDay(t)}`;
  }
  for (let i = 0; i < DAY_WORDS.length; i++) {
    if (DAY_WORDS[i].some(w => q.includes(w))) {
      return i > 5 ? 'В воскресенье пар нет ☕' : `${DAY_IN[i]} ${fmtDay(i)}`;
    }
  }
  // поиск по названию предмета или преподавателю
  for (const day of SCHEDULE) {
    for (const l of day) {
      if (q.includes(l.name.toLowerCase().split(' ')[0]) && l.name.length > 4) {
        const di = SCHEDULE.indexOf(day);
        return `${l.name}: ${DAY_IN[di].toLowerCase()} в ${l.start} — ${l.end}, ауд. ${l.room}, ${l.teacher}.`;
      }
    }
  }
  if (q.includes('экзамен') || q.includes('сесси')) {
    const ex = st.exams || [];
    if (!ex.length) return 'Экзаменов пока нет — добавь их в разделе «Экзамены» на главной.';
    return 'Экзамены:\n' + ex.map(x => `•  ${x.subject} — ${x.date}, ${x.time}${x.room && x.room !== '—' ? ', ауд. ' + x.room : ''}`).join('\n');
  }
  if (q.includes('задач') || q.includes('дз') || q.includes('домаш') || q.includes('задан')) {
    const undone = (st.tasks || []).filter(x => !x.done);
    if (!undone.length) return 'Все задачи выполнены — красота! 🎉';
    return `Невыполненных задач: ${undone.length}\n` + undone.map(x => `•  ${x.title}${x.due ? ' (до ' + x.due + ')' : ''}`).join('\n');
  }
  if (q.includes('афиш') || q.includes('событ') || q.includes('мероприят')) {
    const ev = st.events || [];
    if (!ev.length) return 'В афише пока пусто.';
    return 'Ближайшие события:\n' + ev.slice(0, 5).map(e => `•  ${e.title} — ${e.date}`).join('\n');
  }
  if (q.includes('групп') || q.includes(' код ') || q.includes('qr') || q.includes('кюар')) {
    if (st.group) return `Твоя группа: ${st.group.name}. ${st.group.role === 'owner' ? 'Ты староста' : 'Расписание ведёт староста'}. Чтобы позвать одногруппника — открой Профиль → Моя группа и покажи ему QR-код.`;
    return 'Ты пока не в группе. Профиль → «Добавить мою группу»: староста нажимает «Я староста» и показывает QR, остальные — «Сканировать QR».';
  }
  if (q.includes('монет') || q.includes('coin') || q.includes('коин')) {
    return `У тебя ${st.coins ?? 0} O-COIN. За каждую выполненную задачу — +10.`;
  }
  if (q.includes('привет') || q.includes('салем') || q.includes('салам') || q.includes('здравств')) {
    return 'Привет! Я помогу с расписанием: спроси «какая следующая пара?», «что завтра?» или назови день недели.';
  }
  return 'Пока я отвечаю только про расписание: попробуй «какая следующая пара?», «что сегодня?», «что в среду?» или название предмета. Скоро стану умнее 😉';
}

export const AI_SUGGESTIONS = ['Какая следующая пара?', 'Что сегодня?', 'Что завтра?', 'Когда экзамены?'];

/* Сводка всех данных студента для облачного ИИ */
export function buildAiContext(state) {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const now = tzNow();
  const lines = [`Сегодня: ${now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}, время ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`];
  const sched = state.schedule || SCHEDULE;
  lines.push('Расписание недели:');
  sched.forEach((day, i) => {
    if (!day.length) return;
    lines.push(`${days[i]}: ` + day.map(l => `${l.start}-${l.end} ${l.name}${l.cancelled ? ' (ОТМЕНЕНА)' : ''} (ауд. ${l.room}, ${l.teacher})`).join('; '));
  });
  if (state.exams?.length) lines.push('Экзамены: ' + state.exams.map(x => `${x.subject} — ${x.date} ${x.time}`).join('; '));
  const undone = (state.tasks || []).filter(t => !t.done);
  if (undone.length) lines.push('Невыполненные задачи: ' + undone.map(t => `${t.title}${t.due ? ' (до ' + t.due + ')' : ''}`).join('; '));
  if (state.events?.length) lines.push('Афиша: ' + state.events.slice(0, 6).map(e => `${e.title} — ${e.date}`).join('; '));
  if (state.group) lines.push(`Группа: ${state.group.name}, роль: ${state.group.role === 'owner' ? 'староста' : 'участник'}`);
  lines.push(`Студент: ${state.profile?.firstName || ''}, ${state.setup?.university || ''}, ${state.setup?.faculty || ''}, ${state.setup?.course || ''} курс. Монет O-COIN: ${state.coins ?? 0}`);
  return lines.join('\n');
}

/* ---------- Режим администратора ---------- */
export const AI_SUGGESTIONS_ADMIN = ['Сводка по приложению', 'Кто новые студенты?', 'Что в форумах?', 'Какие события в афише?'];

export function adminAnswer(qRaw, adm, st) {
  const q = qRaw.toLowerCase();
  const s = (adm && adm.stats) || {};
  if (q.includes('сводка') || q.includes('статист') || q.includes('сколько')) {
    return `Сводка ORTA:\n•  Студентов: ${s.users ?? 0}\n•  Групп: ${s.groups ?? 0}\n•  Постов в форумах: ${s.posts ?? 0}\n•  Событий в афише: ${s.events ?? 0}`;
  }
  if (q.includes('форум') || q.includes('пост')) {
    const p = (adm && adm.posts) || [];
    if (!p.length) return 'В форумах пока пусто.';
    return 'Последние посты:\n' + p.slice(0, 5).map(x => `•  ${x.author}: ${String(x.body).slice(0, 60)}`).join('\n');
  }
  if (q.includes('студент') || q.includes('нов') || q.includes('пользовател')) {
    const pr = (adm && adm.profiles) || [];
    if (!pr.length) return 'Студентов пока нет.';
    return `Всего студентов: ${s.users ?? pr.length}. Последние:\n` + pr.slice(0, 5).map(x => `•  ${x.first_name} ${x.last_name} — ${x.university}`).join('\n');
  }
  if (q.includes('событ') || q.includes('афиш') || q.includes('реклам')) {
    const ev = (adm && adm.events) || [];
    if (!ev.length) return 'Афиша пуста — опубликуйте событие на дашборде.';
    return 'События:\n' + ev.slice(0, 5).map(e => `•  ${e.title} — ${e.date_text}${e.user_id ? '' : ' (для всех)'}`).join('\n');
  }
  return aiAnswer(qRaw, st);
}

export function buildAdminContext(adm, state) {
  const s = (adm && adm.stats) || {};
  const lines = [
    'РЕЖИМ АДМИНИСТРАТОРА приложения ORTA. Пользователь — владелец приложения (BOSS).',
    `Статистика: студентов ${s.users ?? 0}, групп ${s.groups ?? 0}, постов ${s.posts ?? 0}, событий ${s.events ?? 0}.`,
  ];
  if (adm?.profiles?.length) lines.push('Последние студенты: ' + adm.profiles.slice(0, 8).map(p => `${p.first_name} ${p.last_name} (${p.university}${p.group_name ? ', ' + p.group_name : ''})`).join('; '));
  if (adm?.posts?.length) lines.push('Последние посты форумов: ' + adm.posts.slice(0, 5).map(p => `${p.author}: ${String(p.body).slice(0, 50)}`).join(' | '));
  if (adm?.events?.length) lines.push('Афиша: ' + adm.events.slice(0, 6).map(e => `${e.title} — ${e.date_text}`).join('; '));
  lines.push('--- Личные данные админа как студента: ---');
  lines.push(buildAiContext(state));
  return lines.join('\n');
}
