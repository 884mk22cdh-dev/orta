// Переводы и определение связи.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { setLang, getLang, t, tPlural } from '../src/i18n.js';
import { TR_TABLES } from '../src/tr.js';

/* ─────────── Словарь i18n ─────────── */
test('во всех трёх языках один и тот же набор ключей', () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, '../src/i18n.js'), 'utf8');
  const keysOf = lang => {
    const at = src.indexOf(`\n  ${lang}: {`);
    const rest = src.slice(at);
    const end = rest.search(/^\s{2}\},/m);
    const body = rest.slice(0, end);
    return new Set([...body.matchAll(/(?:^|[{,]\s*)([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm)].map(m => m[1]));
  };
  const ru = keysOf('ru'), kk = keysOf('kk'), en = keysOf('en');
  const missKk = [...ru].filter(k => !kk.has(k));
  const missEn = [...ru].filter(k => !en.has(k));
  assert.deepEqual(missKk, [], 'нет в казахском');
  assert.deepEqual(missEn, [], 'нет в английском');
});

test('переключение языка меняет ответ t()', () => {
  setLang('ru'); const ru = t('afisha');
  setLang('kk'); const kk = t('afisha');
  setLang('en'); const en = t('afisha');
  setLang('ru');
  assert.notEqual(ru, en);
  assert.ok(ru && kk && en);
});

test('неизвестный ключ возвращается как есть, а не «undefined»', () => {
  setLang('ru');
  assert.equal(t('такого-ключа-нет'), 'такого-ключа-нет');
});

test('неизвестный язык не переключает — остаёмся на прежнем', () => {
  setLang('ru');
  setLang('клингонский');
  assert.equal(getLang(), 'ru');
});

test('склонения через tPlural: русские формы верные', () => {
  setLang('ru');
  assert.equal(tPlural(1, 'tsCount'), '1 студент');
  assert.equal(tPlural(3, 'tsCount'), '3 студента');
  assert.equal(tPlural(7, 'tsCount'), '7 студентов');
  assert.equal(tPlural(11, 'tsCount'), '11 студентов');
});

test('склонения на английском: единственное и множественное', () => {
  setLang('en');
  assert.equal(tPlural(1, 'tsCount'), '1 student');
  assert.equal(tPlural(5, 'tsCount'), '5 students');
  setLang('ru');
});

/* ─────────── Таблица tr ─────────── */
test('в kk и en одинаковый набор строк', () => {
  const kk = Object.keys(TR_TABLES.kk), en = Object.keys(TR_TABLES.en);
  assert.deepEqual(kk.filter(k => !(k in TR_TABLES.en)), [], 'есть только в kk');
  assert.deepEqual(en.filter(k => !(k in TR_TABLES.kk)), [], 'есть только в en');
  assert.ok(kk.length > 150, `строк всего ${kk.length}`);
});

test('ни один перевод не пустой и не равен русскому', () => {
  for (const lang of ['kk', 'en']) {
    for (const [ru, v] of Object.entries(TR_TABLES[lang])) {
      assert.ok(v && v.trim(), `${lang}: пустой перевод для «${ru}»`);
      // имена собственные и одинаковые слова допустимы, но их немного
      if (v === ru && !/Виджет|Университет|Колледж|Факультет|Математика|Маск|курс|Курс/.test(ru)) {
        assert.fail(`${lang}: «${ru}» не переведено`);
      }
    }
  }
});

test('в переводах нет случайной кириллицы в английском', () => {
  const suspicious = Object.entries(TR_TABLES.en)
    .filter(([, v]) => /[а-яА-ЯёЁ]/.test(v))
    .map(([k]) => k);
  assert.deepEqual(suspicious, [], 'английский перевод содержит русские буквы');
});

/* ─────────── Определение связи ─────────── */
test('связь: одна неудача не считается потерей, две подряд — считаются', async () => {
  const net = await import('../src/net.js');
  assert.equal(net.isOnline(), true, 'на старте считаем, что связь есть');
  net.markOffline();
  assert.equal(net.isOnline(), true, 'после одной неудачи связь ещё есть');
  net.markOffline();
  assert.equal(net.isOnline(), false, 'после двух подряд — потеряна');
  net.markOnline();
  assert.equal(net.isOnline(), true, 'один успех возвращает связь');
  net.markOffline();
  assert.equal(net.isOnline(), true, 'счётчик сброшен: снова нужны две');
  net.markOnline();
});

test('связь: подписчик получает только настоящие изменения', async () => {
  const net = await import('../src/net.js');
  const seen = [];
  const off = net.onNetChange(v => seen.push(v));
  net.markOffline(); net.markOffline();     // → false
  net.markOffline(); net.markOffline();     // повторы не должны слать
  net.markOnline();                          // → true
  net.markOnline();                          // повтор не должен слать
  off();
  net.markOffline(); net.markOffline();     // после отписки — тишина
  net.markOnline();
  assert.deepEqual(seen, [false, true]);
});

/* ─────────── Фильтр чата (App Store 1.2) ─────────── */
test('фильтр пропускает обычные сообщения студентов', async () => {
  const { checkPost } = await import('../src/moderation.js');
  for (const ok of [
    'Привет, когда пара по матану?', 'Кто скинет конспект?', 'Сукно для стола',
    'Хуанхэ — река в Китае', 'Экзамен 5 числа в 214 аудитории', 'Хорошо, договорились',
  ]) assert.equal(checkPost(ok), null, `не должно блокировать: «${ok}»`);
});

test('фильтр ловит брань, в том числе замаскированную', async () => {
  const { checkPost } = await import('../src/moderation.js');
  for (const bad of ['Иди на хуй', 'ты сука', 'fuck this', 'х у й', 'х*й', 'ху0й', 'б л я д ь', 'f*ck']) {
    assert.equal(checkPost(bad), 'modProfanity', `должно блокировать: «${bad}»`);
  }
});

test('фильтр отсекает пустое, слишком длинное и крик', async () => {
  const { checkPost } = await import('../src/moderation.js');
  assert.equal(checkPost(''), 'modEmpty');
  assert.equal(checkPost('   '), 'modEmpty');
  assert.equal(checkPost('a'.repeat(1200)), 'modTooLong');
  assert.equal(checkPost('ЭТО ОЧЕНЬ ВАЖНОЕ СООБЩЕНИЕ ДЛЯ ВСЕХ'), 'modCaps');
  assert.equal(checkPost('ОК'), null, 'короткие заглавные — не крик');
});
