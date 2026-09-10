// Статическая проверка перед запуском: ловит то, что не ловит `expo export`.
// Сборка проходит даже если компонент удалён — ошибка вылезает только при
// отрисовке на телефоне («Property 'X' doesn't exist»). Этот скрипт ловит
// такое заранее.
//
//   node scripts/check.mjs
//
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let problems = 0;
const ok = (label, bad) => {
  if (bad && bad.length) { problems += bad.length; console.log(`❌ ${label}: ${bad.join(', ')}`); }
  else console.log(`✅ ${label}`);
};

const SOURCES = ['App.js', 'src/screens.js', 'src/ui.js', 'src/ai.js', 'src/notifications.js', 'src/data.js', 'src/attendance.js', 'src/time.js'];
const ALL = [...SOURCES, 'src/i18n.js', 'src/backend.js', 'src/colleges.js', 'src/universities.js'];

/* 0. Синтаксис: файл вообще разбирается? Ловит незакрытые скобки и «else if» после «else». */
{
  const { parse } = await import('@babel/parser');
  const bad = [];
  for (const f of ALL) {
    try { parse(read(f), { sourceType: 'module', plugins: ['jsx'] }); }
    catch (e) { bad.push(`${f} — ${e.message}`); }
  }
  ok('синтаксис', bad);
  if (bad.length) { console.log('\n❌ дальше проверять нет смысла'); process.exit(1); }
}

/* 1. Каждый <Компонент> определён в файле или импортирован */
for (const f of SOURCES) {
  if (!/screens|ui|App/.test(f)) continue;
  const s = read(f);
  const used = new Set([...s.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)].map(m => m[1]));
  const defined = new Set([
    ...[...s.matchAll(/(?:export\s+)?function\s+([A-Z][A-Za-z0-9_]*)/g)].map(m => m[1]),
    ...[...s.matchAll(/const\s+([A-Z][A-Za-z0-9_]*)\s*=/g)].map(m => m[1]),
  ]);
  const imported = new Set([...s.matchAll(/import\s+\*\s+as\s+([A-Za-z0-9_]+)/g)].map(m => m[1]));
  for (const m of s.matchAll(/import\s+(?:([A-Za-z0-9_]+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from/g)) {
    if (m[1]) imported.add(m[1]);
    for (const part of (m[2] || '').split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) imported.add(name);
    }
  }
  ok(`${f}: компоненты`, [...used].filter(u => !defined.has(u) && !imported.has(u)));
}

/* 2. Каждый s.стиль существует в таблице стилей */
{
  const s = read('src/screens.js');
  const table = s.slice(s.indexOf('const makeS = () => StyleSheet.create({'));
  const styles = new Set([...table.matchAll(/^\s{2}([a-zA-Z0-9_]+):/gm)].map(m => m[1]));
  const used = new Set([...s.matchAll(/\bs\.([a-zA-Z0-9_]+)/g)].map(m => m[1]));
  ok('screens.js: стили', [...used].filter(u => !styles.has(u)));
}

/* 3. Каждый t('ключ') есть в русском словаре */
{
  const i18 = read('src/i18n.js');
  const ru = i18.slice(i18.indexOf('  ru: {'), i18.indexOf('  kk: {'));
  const keys = new Set([...ru.matchAll(/([a-zA-Z0-9_]+)\s*:/g)].map(m => m[1]));
  const bad = [];
  for (const f of SOURCES) {
    for (const m of read(f).matchAll(/\bt\('([^']+)'\)/g)) {
      if (!keys.has(m[1])) bad.push(`${f} → ${m[1]}`);
    }
  }
  ok('ключи перевода', bad);
}

/* 4. Все три языка описывают один и тот же набор ключей */
{
  const i18 = read('src/i18n.js');
  const cut = (a, b) => i18.slice(i18.indexOf(a), b ? i18.indexOf(b) : undefined);
  const keysOf = block => new Set([...block.matchAll(/^\s{4}([a-zA-Z0-9_]+)\s*:/gm)].map(m => m[1]));
  const ru = keysOf(cut('  ru: {', '  kk: {'));
  const kk = keysOf(cut('  kk: {', '  en: {'));
  const en = keysOf(cut('  en: {'));
  ok('kk: нет пропусков', [...ru].filter(k => !kk.has(k)));
  ok('en: нет пропусков', [...ru].filter(k => !en.has(k)));
}

/* 5. Экраны, которые импортирует App.js, действительно экспортированы */
{
  const app = read('App.js'), s = read('src/screens.js');
  const m = app.match(/import \{([^}]*)\} from '\.\/src\/screens'/s);
  const need = m[1].split(',').map(x => x.trim()).filter(Boolean);
  const exp = new Set([...s.matchAll(/export function ([A-Za-z0-9_]+)/g)].map(x => x[1]));
  ok(`App ← screens (${need.length} экранов)`, need.filter(n => !exp.has(n)));
}

/* 6. Каждый actions.xxx из экранов существует в App.js */
{
  const app = read('App.js');
  const block = app.slice(app.indexOf('  const actions = {'), app.indexOf('  actionsRef.current = actions;'));
  const defined = new Set([...block.matchAll(/^\s{4}([a-zA-Z0-9_]+)\s*:/gm)].map(m => m[1]));
  const used = new Set([...read('src/screens.js').matchAll(/\bactions\.([a-zA-Z0-9_]+)/g)].map(m => m[1]));
  ok('actions из экранов', [...used].filter(u => !defined.has(u)));
}

/* 7. Каждый route.name, на который есть nav(), отрисовывается */
{
  const app = read('App.js');
  const rendered = new Set([...app.matchAll(/route\.name === '([a-zA-Z]+)'/g)].map(m => m[1]));
  ['home', 'afisha', 'ai', 'notifications', 'profile'].forEach(r => rendered.add(r));
  const navved = new Set([...read('src/screens.js').matchAll(/nav\('([a-zA-Z]+)'\)/g)].map(m => m[1]));
  ok('маршруты nav()', [...navved].filter(r => !rendered.has(r)));
}

/* 8. state и stateRef равны null, пока состояние грузится из хранилища.
      Экраны от этого защищены («if (!state) → LoadingScreen»), а вот модалки
      в конце render рисуются всегда — там обращаться только через ?. */
{
  const app = read('App.js');
  const lines = app.split('\n');
  const bad = [];

  lines.forEach((ln, i) => {
    if (/stateRef\.current\.[a-zA-Z]/.test(ln)) bad.push(`App.js:${i + 1} — stateRef.current. без ?.`);
  });

  // всё, что после начала блока отрисовки, рисуется независимо от state
  const start = lines.findIndex(l => l.includes('<View style={{ flex: 1, backgroundColor: C.bg }}>'));
  if (start >= 0) {
    lines.slice(start).forEach((ln, i) => {
      if (/[^?.\w]state\.[a-zA-Z]/.test(ln)) bad.push(`App.js:${start + i + 1} — state. без ?. в модалке`);
    });
  }
  ok('state и stateRef только через ?.', bad);
}

/* 9. Экраны с обязательной кнопкой должны прокручиваться.
      Причина: Apple отклонила 1.0(9) — «Unable to bypass the initial onboarding
      screen» на iPad. Приложение для iPhone открывается на iPadOS в окне
      произвольной высоты, и без прокрутки кнопка уезжает за край. */
{
  const s = read('src/screens.js');
  const must = ['WelcomeScreen', 'SetupScreen', 'StartScreen', 'LoginScreen'];
  const bad = [];
  for (const name of must) {
    const i = s.indexOf('export function ' + name);
    if (i < 0) { bad.push(`${name} не найден`); continue; }
    const rest = s.slice(i + 10);
    const end = rest.search(/\nexport function |\n\/\* =+/);
    const body = rest.slice(0, end > 0 ? end : 6000);
    if (!/ScrollView/.test(body)) bad.push(`${name} без ScrollView`);
    const fixed = [...body.matchAll(/height:\s*(\d{3,})/g)].map(m => Number(m[1])).filter(h => h > 250);
    if (fixed.length) bad.push(`${name}: жёсткая высота ${fixed.join(',')}`);
  }
  ok('экраны онбординга прокручиваются', bad);
}

/* 10. Импортировано, но ни разу не использовано.
      Ровно так потерялась роль преподавателя: becomeTeacher была в импортах,
      а вызов не применился — приложение молча пускало учителя как студента. */
{
  const bad = [];
  for (const f of ['App.js', 'src/screens.js']) {
    const src = read(f);
    const names = new Set();
    for (const m of src.matchAll(/import\s+(?:([A-Za-z0-9_]+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from/g)) {
      if (m[1]) names.add(m[1]);
      for (const part of (m[2] || '').split(',')) {
        const n = part.trim().split(/\s+as\s+/).pop().trim();
        if (n) names.add(n);
      }
    }
    // вырезаем сами инструкции import целиком, включая многострочные
    const body = src.replace(/import[\s\S]*?from\s*'[^']*';?/g, '').replace(/import\s*'[^']*';?/g, '');
    for (const n of names) {
      if (n === 'React') continue;   // нужен транспайлеру, в коде не встречается
      const uses = (body.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length;
      if (uses === 0) bad.push(`${f}: ${n} импортирован, но не используется`);
    }
  }
  ok('нет мёртвых импортов', bad);
}

/* 12. Имена иконок: неизвестное имя молча подменяется книгой, ошибки не будет */
{
  const ui = read('src/ui.js');
  const map = ui.slice(ui.indexOf('const ICONS = {'), ui.indexOf('export function Icon'));
  const known = new Set([...map.matchAll(/'([a-z0-9-]+)'\s*:|(?:^|[{,]\s*)([a-z][A-Za-z0-9]*)\s*:/gm)].map(m => m[1] || m[2]));
  const bad = new Set();
  for (const f of ['App.js', 'src/screens.js', 'src/ui.js']) {
    for (const m of read(f).matchAll(/(?:<Icon[^>]*?\bname|\bicon)=(?:"([a-z0-9-]+)"|'([a-z0-9-]+)'|\{'([a-z0-9-]+)'\})/g)) {
      const n = m[1] || m[2] || m[3];
      if (!known.has(n)) bad.add(`${f}: ${n}`);
    }
  }
  ok('имена иконок', [...bad]);
}

/* 13. Тупики: экран без нижней панели и без кнопки «назад» — из него не выйти.
      Именно так преподаватель застревал в журнале и не видел свой профиль. */
{
  const app = read('App.js');
  const scr = read('src/screens.js');
  const tabbed = new Set((app.match(/const showTab = \[([^\]]*)\]/) || [, ''])[1]
    .match(/'([a-zA-Z]+)'/g)?.map(x => x.slice(1, -1)) || []);

  // route -> компонент, который он рисует
  const pairs = [...app.matchAll(/route\.name === '([a-zA-Z]+)'[^\n]*?screen = [\s\S]{0,120}?<([A-Z][A-Za-z0-9]*)/g)];
  const bad = [];
  for (const [, route, comp] of pairs) {
    if (tabbed.has(route) || route === 'loading') continue;   // заставка сама уходит
    const at = scr.indexOf(`export function ${comp}(`);
    if (at < 0) continue;                       // компонент живёт в App.js — проверяем ниже
    const next = scr.indexOf('\nexport function ', at + 1);
    const body = scr.slice(at, next < 0 ? scr.length : next);
    const canLeave = /chevron-left|onBack|actions\.back|nav\('/.test(body);
    if (!canLeave) bad.push(`${route} → ${comp}: ни панели вкладок, ни выхода`);
  }
  ok('нет экранов-тупиков', bad);
}

/* 14. Один ключ дважды в одном словаре: JS молча оставляет последний,
      и перевод подменяется без единой ошибки. */
{
  const src = read('src/i18n.js');
  const bad = [];
  for (const lang of ['ru', 'kk', 'en']) {
    const at = src.indexOf(`\n  ${lang}: {`);
    if (at < 0) continue;
    const rest = src.slice(at);
    const end = rest.search(/^\s{2}\},/m);
    const body = rest.slice(0, end < 0 ? rest.length : end);
    const seen = new Set();
    for (const m of body.matchAll(/(?:^|[{,]\s*)([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm)) {
      const k = m[1];
      if (seen.has(k)) bad.push(`${lang}.${k}`);
      seen.add(k);
    }
  }
  ok('нет повторов ключей в словарях', [...new Set(bad)]);
}

console.log(problems ? `\n❌ проблем: ${problems}` : '\n✅ всё на месте');
process.exit(problems ? 1 : 0);
