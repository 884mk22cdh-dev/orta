// Опись всех нажимаемых элементов приложения и проверка, что каждый что-то делает.
//
//   node scripts/buttons.mjs          — сводка
//   node scripts/buttons.mjs --list   — полный список с номерами строк

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const LIST = process.argv.includes('--list');

const FILES = ['src/screens.js', 'App.js'];
const TAGS = ['Pressable', 'PrimaryButton', 'IconBtn', 'ListRow', 'Chip', 'Switch', 'TouchableOpacity'];

/* Действия, объявленные в App.js */
const app = read('App.js');
const aStart = app.indexOf('  const actions = {');
const aEnd = app.indexOf('  actionsRef.current = actions;');
const actionNames = new Set([...app.slice(aStart, aEnd).matchAll(/^\s{4}([a-zA-Z0-9_]+)\s*[:(]/gm)].map(m => m[1]));

/* Маршруты, которые реально отрисовываются */
const routes = new Set([...app.matchAll(/route\.name === '([a-zA-Z]+)'/g)].map(m => m[1]));
['home', 'afisha', 'ai', 'notifications', 'profile'].forEach(r => routes.add(r));

const problems = [];
const stats = { total: 0, withHandler: 0, byTag: {} };

for (const file of FILES) {
  const src = read(file);
  const lines = src.split('\n');

  lines.forEach((line, i) => {
    for (const tag of TAGS) {
      const re = new RegExp(`<${tag}[\\s/>]`);
      if (!re.test(line)) continue;

      // собираем элемент целиком: от тега до закрывающей скобки
      let chunk = '', depth = 0, started = false;
      for (let j = i; j < Math.min(i + 25, lines.length); j++) {
        chunk += lines[j] + '\n';
        for (const ch of lines[j]) {
          if (ch === '<') { started = true; depth++; }
          if (ch === '>') depth--;
        }
        if (started && depth <= 0) break;
      }

      stats.total++;
      stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
      const at = `${file}:${i + 1}`;

      // Switch управляется onPress, ListRow может быть только для показа
      const hasPress = /onPress\s*=/.test(chunk);
      const hasLongPress = /onLongPress\s*=/.test(chunk);
      const propPress = /onPress=\{(onPress|onNext|onBack|onOpen|onToggle|onDelete|onSet|onSend|onResend|onSendCode|onVerify|onPassword|onLogin|onTeacher|onRefresh|onPick|onOpenPhoto)\b/.test(chunk);

      if (!hasPress && !hasLongPress) {
        // ListRow без onPress бывает информационным — отмечаем отдельно
        problems.push({ at, tag, kind: 'без обработчика', chunk: line.trim().slice(0, 70) });
        continue;
      }
      stats.withHandler++;

      // пустышки
      if (/onPress=\{\(\)\s*=>\s*\{\s*\}\}/.test(chunk) || /onPress=\{(undefined|null)\}/.test(chunk)) {
        problems.push({ at, tag, kind: 'пустой обработчик', chunk: line.trim().slice(0, 70) });
        continue;
      }

      // действие существует?
      for (const m of chunk.matchAll(/actions\.([a-zA-Z0-9_]+)/g)) {
        if (!actionNames.has(m[1])) {
          problems.push({ at, tag, kind: `нет действия actions.${m[1]}`, chunk: line.trim().slice(0, 70) });
        }
      }

      // маршрут существует?
      for (const m of chunk.matchAll(/nav\('([a-zA-Z]+)'\)/g)) {
        if (!routes.has(m[1])) {
          problems.push({ at, tag, kind: `нет экрана '${m[1]}'`, chunk: line.trim().slice(0, 70) });
        }
      }

      if (LIST) console.log(`  ${at.padEnd(22)} ${tag.padEnd(14)} ${propPress ? '(проп)' : ''}`);
    }
  });
}

/* Действия, которые нигде не вызываются */
const allSrc = FILES.map(read).join('\n');
const unusedActions = [...actionNames].filter(n => {
  // объявление вида `name: (...)` не считаем за использование
  const decl = new RegExp(`^\\s{4}${n}\\s*[:(]`, 'gm');
  const body = allSrc.replace(decl, '    __decl__:');
  const uses = (body.match(new RegExp(`actions\\.${n}\\b|actionsRef\\.current\\.${n}\\b`, 'g')) || []).length;
  return uses === 0;
});

/* Экраны, на которые нельзя попасть */
const navved = new Set([...allSrc.matchAll(/nav\('([a-zA-Z]+)'\)/g)].map(m => m[1]));
// маршрут могут задать и через тернарник: setRoute({ name: x ? 'home' : 'start' })
[...allSrc.matchAll(/setRoute\(\{[^}]*name:[^}]*?'([a-zA-Z]+)'/g)].forEach(m => navved.add(m[1]));
[...allSrc.matchAll(/name:\s*'([a-zA-Z]+)'\s*[,}]/g)].forEach(m => navved.add(m[1]));
const unreachable = [...routes].filter(r => !navved.has(r) && !['home', 'afisha', 'ai', 'notifications', 'profile', 'loading', 'onboarding'].includes(r));

console.log('НАЖИМАЕМЫХ ЭЛЕМЕНТОВ:', stats.total);
for (const [k, v] of Object.entries(stats.byTag).sort((a, b) => b[1] - a[1])) console.log(`   ${String(v).padStart(3)} ${k}`);
console.log('с обработчиком:', stats.withHandler);

console.log('\nПРОБЛЕМЫ:', problems.length);
for (const p of problems) console.log(`  ❌ ${p.at} — ${p.tag} — ${p.kind}\n       ${p.chunk}`);

console.log('\nДЕЙСТВИЯ БЕЗ ВЫЗОВА:', unusedActions.length ? unusedActions.join(', ') : 'нет');
console.log('ЭКРАНЫ БЕЗ ВХОДА:', unreachable.length ? unreachable.join(', ') : 'нет');

process.exit(problems.length ? 1 : 0);
