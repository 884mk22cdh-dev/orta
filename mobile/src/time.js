// Единое время приложения — всегда Астана (Asia/Almaty, UTC+5).
// Иначе студент с телефоном на «Лондон» видел бы вчерашний день, а вечерняя
// пара уезжала бы на другие сутки. Всё расписание Казахстана живёт по Астане.

export const TZ = 'Asia/Almaty';

let fmt = null;
try {
  fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
} catch (e) {
  fmt = null; // старый JS-движок без полной ICU — откатываемся на время устройства
}

/**
 * «Сейчас» по Астане в виде обычного Date: локальные поля (getFullYear,
 * getHours и т.д.) уже содержат астанинское время, поэтому весь остальной код
 * работает как раньше, без правок.
 */
export function now() {
  const d = new Date();
  if (!fmt) return d;
  try {
    const p = {};
    for (const part of fmt.formatToParts(d)) p[part.type] = part.value;
    const h = p.hour === '24' ? 0 : Number(p.hour); // некоторые движки дают 24 вместо 00
    return new Date(Number(p.year), Number(p.month) - 1, Number(p.day), h, Number(p.minute), Number(p.second));
  } catch (e) {
    return d;
  }
}

/** Минуты с полуночи по Астане — для подсветки «идёт сейчас». */
export function nowMinutes() {
  const n = now();
  return n.getHours() * 60 + n.getMinutes();
}

/** Сегодняшняя дата по Астане, обнулённая до полуночи. */
export function today() {
  const n = now();
  n.setHours(0, 0, 0, 0);
  return n;
}
