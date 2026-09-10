// Ищет русский текст, который доходит до пользователя мимо переводов.
//
//   node scripts/i18n-audit.mjs           — сводка
//   node scripts/i18n-audit.mjs --list    — с номерами строк
//
// Считаем только то, что человек видит: содержимое <Text>, подписи кнопок,
// подсказки полей, тосты и предупреждения. Комментарии и служебные строки
// вроде 'Лекция' в данных не трогаем.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const LIST = process.argv.includes('--list');
const FILES = ['App.js', 'src/screens.js', 'src/ui.js', 'src/ai.js', 'src/notifications.js'];

const CYR = /[а-яА-ЯёЁәіңғүұқөһӘІҢҒҮҰҚӨҺ]/;

// Куда попадает текст, который видит человек
const SINKS = [
  [/showToast\(\s*'([^']{3,})'/g, 'тост'],
  [/showToast\(\s*`([^`$]{3,})`/g, 'тост'],
  [/Alert\.alert\(\s*'([^']{3,})'/g, 'предупреждение'],
  [/text:\s*'([^']{3,})'/g, 'кнопка предупреждения'],
  [/placeholder=(?:"([^"]{2,})"|\{'([^']{2,})'\})/g, 'подсказка поля'],
  [/placeholder="([^"]{2,})"/g, 'подсказка поля'],
  [/label=(?:"([^"]{2,})"|\{'([^']{2,})'\})/g, 'подпись'],
  [/>\s*([^<>{}\n]{3,})\s*<\/Text>/g, 'текст на экране'],
];

const rows = [];
for (const file of FILES) {
  const src = read(file);
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    // комментарии пропускаем
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (!CYR.test(code)) return;
    for (const [re, kind] of SINKS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(code))) {
        const text = (m[1] || m[2] || '').trim();
        if (!text || !CYR.test(text)) continue;
        if (/^\{|\}$/.test(text)) continue;                 // выражение, а не текст
        if (/t\(|tPlural\(/.test(text)) continue;           // уже переведено
        rows.push({ file, line: i + 1, kind, text });
      }
    }
  });
}

// Строка считается покрытой, если она есть в таблицах tr.js: тосты и
// предупреждения переводятся в одной точке, русский текст служит ключом.
const trSrc = read('src/tr.js');
const tableKeys = lang => {
  const at = trSrc.indexOf(`const ${lang} = {`);
  const body = trSrc.slice(at, trSrc.indexOf('\n};', at));
  return new Set([...body.matchAll(/^\s*'((?:[^'\\]|\\.)*)':/gm)].map(m => m[1]));
};
const KKK = tableKeys('KK'), EEE = tableKeys('EN');
const covered = s => KKK.has(s) && EEE.has(s);

// одинаковые тексты считаем один раз
const uniq = new Map();
for (const r of rows) if (!uniq.has(r.text) && !covered(r.text)) uniq.set(r.text, r);

const byFile = {};
const byKind = {};
for (const r of uniq.values()) {
  byFile[r.file] = (byFile[r.file] || 0) + 1;
  byKind[r.kind] = (byKind[r.kind] || 0) + 1;
}

console.log('РУССКИЙ ТЕКСТ МИМО ПЕРЕВОДОВ');
console.log('всего мест:', rows.length, '· без перевода:', uniq.size);
console.log('\nпо файлам:');
for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${f}`);
console.log('\nпо виду:');
for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);

if (LIST) {
  console.log('\nсписок:');
  for (const r of [...uniq.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
    console.log(`  ${r.file}:${String(r.line).padEnd(5)} [${r.kind}] ${r.text.slice(0, 70)}`);
  }
}

// без перевода — это ошибка: приложение обещает три языка
process.exit(uniq.size ? 1 : 0);
