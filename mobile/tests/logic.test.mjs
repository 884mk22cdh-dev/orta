// Проверки поведения — того, что check.mjs увидеть не может.
//
//   npm test
//
// check.mjs проверяет, что код цел и связан; audit.mjs — что бэкенд
// отвечает правильно. Между ними была дыра: расчёты на клиенте.
// Склонения, проценты посещаемости, часовой пояс Астаны, разбор QR —
// ошибка здесь не ломает сборку, её видно только глазами на телефоне.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { plural, toMin, formatPhoneKz, mondayIndex, weekDates, clampDay } from '../src/data.js';
import * as ATT from '../src/attendance.js';
import { now as tzNow, TZ } from '../src/time.js';
import { institutionsOfCity, findInstitution, CITIES } from '../src/universities.js';
import { collegeSpecialties, COLLEGES_KZ } from '../src/colleges.js';

/* ─────────── Русские склонения ─────────── */
test('склонения: 1 студент, 2 студента, 5 студентов', () => {
  const f = n => `${n} ${plural(n, 'студент', 'студента', 'студентов')}`;
  assert.equal(f(1), '1 студент');
  assert.equal(f(2), '2 студента');
  assert.equal(f(5), '5 студентов');
});

test('склонения: 11–14 всегда «студентов», это частая ошибка', () => {
  for (const n of [11, 12, 13, 14, 111, 112]) {
    assert.equal(plural(n, 'студент', 'студента', 'студентов'), 'студентов', `сломалось на ${n}`);
  }
  assert.equal(plural(21, 'студент', 'студента', 'студентов'), 'студент');
  assert.equal(plural(22, 'студент', 'студента', 'студентов'), 'студента');
  assert.equal(plural(101, 'студент', 'студента', 'студентов'), 'студент');
});

test('склонения: ноль — «студентов»', () => {
  assert.equal(plural(0, 'студент', 'студента', 'студентов'), 'студентов');
});

/* ─────────── Время пары ─────────── */
test('время пары переводится в минуты', () => {
  assert.equal(toMin('00:00'), 0);
  assert.equal(toMin('09:00'), 540);
  assert.equal(toMin('23:59'), 1439);
});

test('пары идут по возрастанию минут — на этом строится «следующая пара»', () => {
  const times = ['08:30', '10:15', '12:00', '13:45'];
  const mins = times.map(toMin);
  assert.deepEqual(mins, [...mins].sort((a, b) => a - b));
});

/* ─────────── Телефон Казахстана ─────────── */
test('телефон приводится к виду +7 700 700 70 70', () => {
  assert.equal(formatPhoneKz('7007007070'), '+7 700 700 70 70');
  assert.equal(formatPhoneKz('+7 700 700 70 70'), '+7 700 700 70 70');
  assert.equal(formatPhoneKz('87007007070'), '+7 700 700 70 70');
});

test('пустой телефон не ломается', () => {
  assert.equal(formatPhoneKz(''), '+7 ');
  assert.equal(formatPhoneKz('   '), '+7 ');
});

/* ─────────── Неделя ─────────── */
test('понедельник — нулевой день, воскресенье — шестой', () => {
  assert.equal(mondayIndex(new Date('2026-09-07T12:00:00')), 0);  // понедельник
  assert.equal(mondayIndex(new Date('2026-09-12T12:00:00')), 5);  // суббота
  assert.equal(mondayIndex(new Date('2026-09-13T12:00:00')), 6);  // воскресенье
});

test('воскресенье прижимается к субботе: расписание шестидневное', () => {
  assert.equal(clampDay(mondayIndex(new Date('2026-09-13T12:00:00'))), 5);
});

test('неделя — шесть дней с понедельника, числа идут подряд', () => {
  const w = weekDates();
  assert.equal(w.length, 6);
  assert.equal(w[0].name, 'Пн');
  assert.equal(w[5].name, 'Сб');
  for (let i = 1; i < w.length; i++) {
    const prev = w[i - 1].num, cur = w[i].num;
    assert.ok(cur === prev + 1 || cur === 1, `после ${prev} идёт ${cur}`);
  }
});

/* ─────────── Часовой пояс Астаны ─────────── */
test('время берётся по Астане, а не по часам телефона', () => {
  assert.equal(TZ, 'Asia/Almaty');
  const astana = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Almaty', hour: '2-digit', hour12: false }).format(new Date());
  assert.equal(String(tzNow().getHours()).padStart(2, '0'), astana);
});

test('ключ дня — YYYY-MM-DD', () => {
  assert.match(ATT.dayKey(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(ATT.dayKey(new Date('2026-09-05T10:00:00')), '2026-09-05');
});

/* ─────────── Посещаемость ─────────── */
test('отметка ставится, читается и снимается', () => {
  let a = {};
  a = ATT.setMark(a, '2026-09-07', 'l1', ATT.PRESENT);
  assert.equal(ATT.getMark(a, '2026-09-07', 'l1').status, ATT.PRESENT);
  a = ATT.setMark(a, '2026-09-07', 'l1', ATT.LATE);
  assert.equal(ATT.getMark(a, '2026-09-07', 'l1').status, ATT.LATE, 'отметка перезаписывается');
  a = ATT.setMark(a, '2026-09-07', 'l1', null);
  assert.ok(!ATT.getMark(a, '2026-09-07', 'l1'), 'отметка снимается');
});

test('отметки разных дней и пар не путаются', () => {
  let a = {};
  a = ATT.setMark(a, '2026-09-07', 'l1', ATT.PRESENT);
  a = ATT.setMark(a, '2026-09-08', 'l1', ATT.ABSENT);
  a = ATT.setMark(a, '2026-09-07', 'l2', ATT.LATE);
  assert.equal(ATT.getMark(a, '2026-09-07', 'l1').status, ATT.PRESENT);
  assert.equal(ATT.getMark(a, '2026-09-08', 'l1').status, ATT.ABSENT);
  assert.equal(ATT.getMark(a, '2026-09-07', 'l2').status, ATT.LATE);
});

test('сводка считает пришёл, опоздал и пропустил', () => {
  let a = {};
  a = ATT.setMark(a, '2026-09-07', 'l1', ATT.PRESENT);
  a = ATT.setMark(a, '2026-09-07', 'l2', ATT.LATE);
  a = ATT.setMark(a, '2026-09-08', 'l1', ATT.ABSENT);
  const s = ATT.stats(a);
  assert.equal(s.present, 1);
  assert.equal(s.late, 1);
  assert.equal(s.absent, 1);
});

test('пустая посещаемость не даёт NaN — на этом падают проценты', () => {
  const s = ATT.stats({});
  for (const [k, v] of Object.entries(s)) {
    assert.ok(!Number.isNaN(v), `${k} оказался NaN`);
  }
});

test('сетка месяца — недели по 7 клеток, дней ровно столько, сколько в месяце', () => {
  const days = (y, m) => ATT.monthGrid({}, y, m).flat().filter(Boolean).length;
  assert.equal(days(2026, 1), 28, 'февраль 2026');
  assert.equal(days(2026, 8), 30, 'сентябрь');
  assert.equal(days(2024, 1), 29, 'февраль високосного 2024');
  for (const [y, m] of [[2026, 1], [2026, 8], [2024, 1]]) {
    for (const week of ATT.monthGrid({}, y, m)) assert.equal(week.length, 7, 'неделя не из 7 клеток');
  }
});

test('первое число месяца попадает на верный день недели', () => {
  // 1 февраля 2026 — воскресенье, значит перед ним 6 пустых клеток
  const first = ATT.monthGrid({}, 2026, 1)[0];
  assert.equal(first.filter(x => x === null).length, 6);
  assert.equal(first[6].day, 1);
});

test('отметки попадают в нужную клетку календаря', () => {
  let a = {};
  a = ATT.setMark(a, '2026-09-10', 'l1', ATT.PRESENT);
  a = ATT.setMark(a, '2026-09-10', 'l2', ATT.ABSENT);
  const cell = ATT.monthGrid(a, 2026, 8).flat().find(c => c && c.day === 10);
  assert.equal(cell.present, 1);
  assert.equal(cell.absent, 1);
  assert.equal(cell.total, 2);
});

/* ─────────── Учебные заведения ─────────── */
test('в списке городов нет повторов', () => {
  assert.equal(CITIES.length, new Set(CITIES).size);
});

test('по городу находятся и вузы, и колледжи', () => {
  const astana = institutionsOfCity('Астана');
  assert.ok(astana.length > 5, `в Астане нашлось всего ${astana.length}`);
  assert.ok(astana.some(x => x.kind === 'uni' || x.type === 'uni' || /универ|ENU|ЕНУ|Назарбаев/i.test(x.name || x)),
    'нет ни одного вуза');
});

test('заведение находится по названию', () => {
  const found = findInstitution('Astana IT University', 'Астана');
  assert.ok(found, 'Astana IT University не найден');
});

test('несуществующий город даёт пустой список, а не падение', () => {
  assert.deepEqual(institutionsOfCity('Такого города нет'), []);
  assert.deepEqual(institutionsOfCity(''), []);
  assert.deepEqual(institutionsOfCity(null), []);
});

test('у колледжа подбираются специальности по профилю', () => {
  const med = COLLEGES_KZ.find(c => /медицин/i.test(c.name));
  if (med) {
    const sp = collegeSpecialties(med.name);
    assert.ok(sp.length > 0, 'у медицинского колледжа нет специальностей');
  }
  assert.ok(Array.isArray(collegeSpecialties('Неизвестный колледж')), 'неизвестный колледж должен давать массив');
});
