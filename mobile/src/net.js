// Есть ли связь с нашим сервером.
//
// Намеренно не берём NetInfo: он отвечает «Wi-Fi подключён» и на
// университетской сети с заглушкой, где интернета нет вовсе. Студенту
// важно не наличие Wi-Fi, а отвечает ли сервер — это мы и проверяем,
// по исходу настоящих запросов плюс дешёвая проверка по требованию.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './backend-config';

let online = true;          // считаем, что связь есть, пока не доказано обратное
let misses = 0;             // подряд идущих неудач
let probing = false;
let lastProbe = 0;

const subs = new Set();
const notify = () => { for (const f of subs) { try { f(online); } catch {} } };

/** Подписка на изменение состояния. Возвращает функцию отписки. */
export function onNetChange(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export const isOnline = () => online;

/**
 * Запрос удался. Одного успеха достаточно, чтобы снять пометку «нет связи»:
 * если сервер ответил — значит связь есть.
 */
export function markOnline() {
  misses = 0;
  if (!online) { online = true; notify(); }
}

/**
 * Запрос не удался. Одна неудача — ещё не потеря связи: сервер мог
 * ответить ошибкой на конкретный запрос. Переключаемся после двух подряд.
 */
export function markOffline() {
  misses += 1;
  if (online && misses >= 2) { online = false; notify(); }
}

/**
 * Проверка связи по требованию — когда человек нажал «обновить» или
 * вернулся в приложение. Дешёвая: HEAD на служебный адрес, без данных.
 */
export async function probe() {
  if (probing || Date.now() - lastProbe < 3000) return online;
  probing = true;
  lastProbe = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: 'GET',
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (r.ok || r.status === 401) markOnline();   // 401 тоже значит «сервер жив»
    else { misses = 2; markOffline(); }
  } catch {
    misses = 2;
    markOffline();
  } finally {
    probing = false;
  }
  return online;
}
