// Мой журнал посещаемости.
// Работает полностью локально: отметки хранятся в состоянии приложения и
// переживают офлайн. Это личное доказательство студента на случай, когда
// в системе вуза «Н» стоит незаслуженно.

import { now as tzNow } from './time';

/** «Сейчас» по Астане — журнал должен совпадать с расписанием, а не с часовым поясом телефона. */
export const now = tzNow;

export const PRESENT = 'present';
export const ABSENT = 'absent';
export const LATE = 'late';

const pad = n => String(n).padStart(2, '0');

/** Ключ дня: YYYY-MM-DD в местном времени (не UTC — иначе вечерние пары уезжают на сутки). */
export function dayKey(d = tzNow()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Индекс дня недели как в расписании: 0 = Пн … 5 = Сб, воскресенье → -1. */
export function scheduleDay(d = tzNow()) {
  const js = d.getDay(); // 0 = Вс
  return js === 0 ? -1 : js - 1;
}

/** Поставить отметку. Возвращает новый объект attendance (не мутирует). */
export function setMark(attendance, date, lessonId, status, meta = {}) {
  const day = { ...((attendance || {})[date] || {}) };
  if (!status) delete day[lessonId];
  else day[lessonId] = { status, name: meta.name || day[lessonId]?.name || '', at: Date.now() };
  const next = { ...(attendance || {}) };
  if (Object.keys(day).length) next[date] = day;
  else delete next[date];
  return next;
}

export function getMark(attendance, date, lessonId) {
  return ((attendance || {})[date] || {})[lessonId] || null;
}

/** Пары указанного дня недели из расписания, без отменённых. */
export function lessonsOfDay(schedule, dayIdx) {
  if (dayIdx < 0) return [];
  return ((schedule || [])[dayIdx] || []).filter(l => !l.cancelled);
}

/**
 * Сводка: сколько посещено из отмеченного, по каждому предмету и в целом.
 * Считаем только те пары, где студент реально отметился — процент честный,
 * неотмеченные не превращаются в прогулы задним числом.
 */
export function stats(attendance) {
  const bySubject = new Map();
  let present = 0, absent = 0, late = 0;

  for (const date of Object.keys(attendance || {})) {
    for (const [, mark] of Object.entries(attendance[date] || {})) {
      const name = mark.name || '—';
      if (!bySubject.has(name)) bySubject.set(name, { name, present: 0, absent: 0, late: 0 });
      const row = bySubject.get(name);
      if (mark.status === PRESENT) { row.present++; present++; }
      else if (mark.status === LATE) { row.late++; late++; }
      else if (mark.status === ABSENT) { row.absent++; absent++; }
    }
  }

  const rate = counted => (counted.present + counted.late + counted.absent)
    ? Math.round(((counted.present + counted.late) / (counted.present + counted.late + counted.absent)) * 100)
    : null;

  const subjects = [...bySubject.values()]
    .map(r => ({ ...r, total: r.present + r.late + r.absent, percent: rate(r) }))
    .sort((a, b) => (a.percent ?? 101) - (b.percent ?? 101) || b.total - a.total);

  const total = present + late + absent;
  return { present, absent, late, total, percent: rate({ present, late, absent }), subjects };
}

/** Последние дни с отметками, новые сверху. */
export function recentDays(attendance, limit = 14) {
  return Object.keys(attendance || {})
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, limit)
    .map(date => ({
      date,
      marks: Object.entries(attendance[date]).map(([lessonId, m]) => ({ lessonId, ...m })),
    }));
}

/**
 * Сетка месяца для календаря посещаемости: недели по 7 ячеек, понедельник первый.
 * Каждая ячейка — { key, day, out } (out = день соседнего месяца) плюс сводка отметок.
 */
export function monthGrid(attendance, year, month) {
  const first = new Date(year, month, 1);
  const shift = (first.getDay() + 6) % 7;          // Пн = 0
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < shift; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) {
    const key = dayKey(new Date(year, month, d));
    const marks = Object.values((attendance || {})[key] || {});
    let present = 0, absent = 0, late = 0;
    for (const m of marks) {
      if (m.status === PRESENT) present++;
      else if (m.status === ABSENT) absent++;
      else if (m.status === LATE) late++;
    }
    cells.push({ key, day: d, present, absent, late, total: marks.length });
  }
  while (cells.length % 7) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Есть ли в журнале хоть одна отметка в этом месяце. */
export function monthHasMarks(attendance, year, month) {
  const p = `${year}-${pad(month + 1)}-`;
  return Object.keys(attendance || {}).some(k => k.startsWith(p));
}

/** «5 сентября» из ключа YYYY-MM-DD. months — массив в родительном падеже. */
export function humanDate(key, months) {
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y || !m || !d) return key;
  const name = (months || [])[m - 1] || '';
  const today = dayKey();
  if (key === today) return 'Сегодня';
  const yd = tzNow(); yd.setDate(yd.getDate() - 1);
  if (key === dayKey(yd)) return 'Вчера';
  return `${d} ${name}`;
}
