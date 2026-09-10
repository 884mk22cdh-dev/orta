// Передача расписания в виджет на экране блокировки.
//
// Важно: в App Group кладём ВСЮ неделю, а ближайшую пару виджет считает сам.
// Раньше приложение вычисляло «следующую пару» один раз и записывало её строкой —
// и виджет застревал на этом значении до следующего открытия приложения:
// день сменился, пара прошла, а он всё показывал старое или пустое.

import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';
import { mondayIndex, toMin, nowMin } from './data';
import { now as tzNow } from './time';

const GROUP = 'group.kz.orta.app';
let storage = null;
let initError = null;
try {
  if (Platform.OS === 'ios') storage = new ExtensionStorage(GROUP);
} catch (e) {
  initError = String(e && e.message ? e.message : e);
}

const hhmm = v => String(v || '').slice(0, 5);   // «08:00:00» с сервера → «08:00»
const valid = t => /^\d{1,2}:\d{2}$/.test(hhmm(t));

/** Компактная неделя для виджета: только то, что он рисует. */
export function compactWeek(schedule) {
  return (Array.isArray(schedule) ? schedule : []).slice(0, 6).map(day =>
    (Array.isArray(day) ? day : [])
      .filter(l => l && !l.cancelled && valid(l.start))
      .map(l => ({
        n: String(l.name || 'Пара'),
        s: hhmm(l.start),
        e: valid(l.end) ? hhmm(l.end) : '',
        r: l.room && l.room !== '—' ? String(l.room) : '',
        t: String(l.teacher || ''),
      }))
      .sort((a, b) => toMin(a.s) - toMin(b.s)));
}

/* Ближайшая пара — то же, что считает виджет. Нужна для диагностики и подписей. */
export function findNextLesson(schedule) {
  const week = compactWeek(schedule);
  if (!week.some(d => d.length)) return null;
  const today = mondayIndex(tzNow());
  const mins = nowMin();
  if (today <= 5) {
    const rest = week[today].filter(l => toMin(l.s) > mins);
    if (rest.length) return { ...rest[0], when: 'сегодня' };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (today + i) % 7;
    if (d > 5 || !week[d] || !week[d].length) continue;
    return { ...week[d][0], when: i === 1 ? 'завтра' : '' };
  }
  return null;
}

/** Возвращает человекочитаемый итог — его показывает кнопка диагностики в настройках. */
export function updateWidget(schedule) {
  if (!storage) return initError ? 'модуль виджета не загрузился: ' + initError : 'виджет доступен только на iPhone';
  try {
    const week = compactWeek(schedule);
    const total = week.reduce((n, d) => n + d.length, 0);
    storage.set('schedule_json', JSON.stringify(week));
    storage.set('updated_at', tzNow().toISOString());

    // Старые ключи оставляем: если на телефоне ещё не обновлённый виджет, он их прочитает
    const l = findNextLesson(schedule);
    storage.set('next_name', l ? l.n : '');
    storage.set('next_time', l ? l.s : '');
    storage.set('next_room', l ? l.r : '');
    storage.set('next_teacher', l ? l.t : '');
    storage.set('next_when', l ? String(l.when || '') : '');

    ExtensionStorage.reloadWidget();
    if (!total) return 'в расписании нет ни одной пары — добавьте их, и виджет оживёт';
    return `записано пар: ${total}. Ближайшая: ${l ? `${l.s} · ${l.n}` : 'на этой неделе больше нет'}`;
  } catch (e) {
    return 'ошибка записи: ' + String(e && e.message ? e.message : e);
  }
}
