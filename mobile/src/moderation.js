// Фильтр недопустимых сообщений в чате группы.
//
// App Store Review Guideline 1.2 требует от приложений с пользовательским
// содержимым четыре вещи: фильтрацию недопустимого, кнопку пожаловаться,
// возможность заблокировать автора и контакт для связи. Жалоба и блокировка
// в приложении уже были — здесь закрываем фильтрацию.
//
// Список намеренно короткий и по корням: цель не «поймать всё», а не дать
// отправить явную брань. Всё остальное ловится жалобами.
//
// Тот же список продублирован на сервере (backend/moderation.sql), чтобы
// фильтр нельзя было обойти в обход приложения.

// Корни бранных слов: русские, казахские и английские.
const ROOTS = [
  // русский мат и оскорбления
  'хуй', 'хуе', 'хуё', 'пизд', 'ебан', 'ебат', 'ебал', 'ебуч', 'бляд', 'блять',
  'сука', 'мудак', 'мудил', 'гандон', 'пидор', 'пидар', 'долбоёб', 'долбоеб',
  'ублюд', 'шлюх', 'выблядок', 'залуп', 'манда', 'дрочи',
  // казахский
  'қотақ', 'котак', 'амжақ', 'амжак', 'сігіс', 'сигис', 'енең', 'енен сік',
  // английский
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'motherfuck', 'dickhead',
];

// Буквы, которыми обычно маскируют: 0→о, 3→е, @→а и латиница в русских словах
const LOOKALIKE = {
  '0': 'о', '3': 'е', '4': 'ч', '6': 'б', '@': 'а', '$': 'с', '*': '', '.': '', '-': '', '_': '', ' ': '',
  a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у',
};

/** Приводим текст к виду, в котором маскировка не помогает. */
function normalize(text) {
  let s = String(text || '').toLowerCase().replace(/ё/g, 'е');
  s = s.split('').map(ch => (ch in LOOKALIKE ? LOOKALIKE[ch] : ch)).join('');
  return s.replace(/(.)\1{2,}/g, '$1$1');   // «ххххуй» → «ххуй»
}

// Буквы подряд, без разделителей: ловит «ху0й» → «хуй» и «б л я д ь» → «блядь».
const lettersOnly = text => String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}]/gu, '');

// Маскировка вида «х*й»: звёздочка стоит вместо буквы. Для каждого корня
// готовим образцы, где одна буква заменена маскирующим знаком.
const MASK = '[*#@$%^&0-9]';
const MASKED = ROOTS.flatMap(r => {
  if (r.length < 3) return [];
  const out = [];
  for (let i = 0; i < r.length; i++) {
    out.push(new RegExp(r.slice(0, i) + MASK + r.slice(i + 1)));
  }
  return out;
});

/** Есть ли в тексте явная брань. */
export function hasProfanity(text) {
  const raw = String(text || '').toLowerCase().replace(/ё/g, 'е');
  if (!raw.trim()) return false;
  const norm = normalize(text);
  const bare = lettersOnly(text);
  if (ROOTS.some(r => raw.includes(r) || norm.includes(r) || bare.includes(r))) return true;
  return MASKED.some(re => re.test(raw));
}

/**
 * Можно ли отправлять. Возвращает null, если всё в порядке,
 * иначе ключ перевода с причиной отказа.
 */
export function checkPost(text) {
  const t = String(text || '').trim();
  if (!t) return 'modEmpty';
  if (t.length > 1000) return 'modTooLong';
  if (hasProfanity(t)) return 'modProfanity';
  // сплошные заглавные длиннее 20 знаков читаются как крик
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (letters.length > 20 && letters === letters.toUpperCase()) return 'modCaps';
  return null;
}
