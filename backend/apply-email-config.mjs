// Настраивает письма ORTA через Supabase Management API.
//
//   SUPABASE_PAT=sbp_xxx node backend/apply-email-config.mjs
//   SUPABASE_PAT=sbp_xxx node backend/apply-email-config.mjs --show   (только показать текущее)
//
// Токен берётся здесь: https://supabase.com/dashboard/account/tokens
// Он даёт доступ ко всем проектам аккаунта — после настройки его можно отозвать.

const REF = 'zqjbvrfpuusemdsurskc';
const PAT = process.env.SUPABASE_PAT;
const SHOW_ONLY = process.argv.includes('--show');

if (!PAT) {
  console.error('Нужен токен: SUPABASE_PAT=sbp_xxx node backend/apply-email-config.mjs');
  process.exit(1);
}

const api = async (method, path, body) => {
  const res = await fetch(`https://api.supabase.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return data;
};

const SUBJECT = 'Ваш код в ORTA — {{ .Token }}';

const BODY = `<div style="margin:0;padding:32px 16px;background:#F1F2F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:440px;margin:0 auto;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 8px 32px rgba(83,36,176,.10);">
    <div style="background:#5324B0;padding:28px 32px;">
      <div style="color:#FFFFFF;font-size:22px;font-weight:800;letter-spacing:.02em;">ORTA</div>
      <div style="color:rgba(255,255,255,.75);font-size:13px;margin-top:2px;">Расписание, группа и всё для учёбы</div>
    </div>
    <div style="padding:32px;">
      <div style="font-size:19px;font-weight:700;color:#171320;">Спасибо, что вы с нами!</div>
      <div style="font-size:15px;line-height:1.6;color:#5B5470;margin-top:10px;">
        Вы присоединяетесь к ORTA. Введите этот код в приложении — и всё готово.
      </div>
      <div style="margin:26px 0;padding:20px;background:#F1EBFC;border-radius:16px;text-align:center;">
        <div style="font-size:36px;font-weight:800;letter-spacing:10px;color:#5324B0;">{{ .Token }}</div>
        <div style="font-size:12.5px;color:#7C7489;margin-top:8px;">Код действует 10 минут</div>
      </div>
      <div style="font-size:13.5px;line-height:1.6;color:#7C7489;">
        Никому не сообщайте этот код. Если вы его не запрашивали — просто удалите письмо,
        с вашим аккаунтом ничего не произойдёт.
      </div>
    </div>
    <div style="padding:18px 32px;background:#FAF9FC;border-top:1px solid #EDEAF4;font-size:12.5px;color:#8A829B;">
      С уважением,<br><span style="color:#5324B0;font-weight:700;">ORTA TEAM</span>
    </div>
  </div>
</div>`;

const KEYS = [
  'mailer_otp_exp', 'smtp_sender_name', 'smtp_admin_email', 'smtp_host',
  'mailer_subjects_magic_link', 'mailer_subjects_email_change', 'mailer_subjects_confirmation',
  'mailer_secure_email_change_enabled', 'external_anonymous_users_enabled',
];

const short = v => (typeof v === 'string' && v.length > 70 ? v.slice(0, 70) + '…' : v);

const before = await api('GET', `/projects/${REF}/config/auth`);
console.log('— СЕЙЧАС —');
for (const k of KEYS) console.log(`  ${k}: ${short(before[k])}`);
const hasToken = t => String(before[t] || '').includes('{{ .Token }}');
console.log(`  magic link шлёт код: ${hasToken('mailer_templates_magic_link_content') ? 'да' : 'НЕТ (шлёт ссылку)'}`);
console.log(`  email change шлёт код: ${hasToken('mailer_templates_email_change_content') ? 'да' : 'НЕТ (шлёт ссылку)'}`);

if (SHOW_ONLY) process.exit(0);

console.log('\n— ПРИМЕНЯЮ —');

// Шаг 1: настройки, доступные на любом тарифе
await api('PATCH', `/projects/${REF}/config/auth`, {
  mailer_otp_exp: 600,        // код живёт 10 минут: письмо идёт до минуты, потом его надо переписать
  mailer_otp_length: 6,       // приложение принимает ровно 6 цифр
  rate_limit_email_sent: 100, // по умолчанию было 2 письма в час на весь проект
  mailer_secure_email_change_enabled: false,  // анонимному аккаунту некуда слать «старое» письмо
});
console.log('✅ срок кода, длина кода, лимит писем');

// Шаг 2: свой SMTP — без него Supabase не даёт трогать шаблоны на бесплатном тарифе
if (process.env.SMTP_HOST) {
  await api('PATCH', `/projects/${REF}/config/auth`, {
    smtp_host: process.env.SMTP_HOST,
    smtp_port: String(process.env.SMTP_PORT || 587),  // API ждёт строку, не число
    smtp_user: process.env.SMTP_USER,
    smtp_pass: process.env.SMTP_PASS,
    smtp_admin_email: process.env.SMTP_FROM,
    smtp_sender_name: 'ORTA TEAM',
  });
  console.log('✅ свой SMTP, отправитель ORTA TEAM');
}

// Шаг 3: шаблоны с шестизначным кодом
try {
  await api('PATCH', `/projects/${REF}/config/auth`, {
    mailer_subjects_magic_link: SUBJECT,
    mailer_templates_magic_link_content: BODY,
    mailer_subjects_email_change: SUBJECT,
    mailer_templates_email_change_content: BODY,
    mailer_subjects_confirmation: SUBJECT,
    mailer_templates_confirmation_content: BODY,
  });
  console.log('✅ шаблоны писем с кодом');
} catch (e) {
  if (/free tier|custom SMTP/i.test(e.message)) {
    console.log('⛔ шаблоны НЕ применены: Supabase не даёт менять их на бесплатном тарифе');
    console.log('   со встроенным отправителем. Нужен свой SMTP — передайте переменные:');
    console.log('   SMTP_HOST=… SMTP_PORT=587 SMTP_USER=… SMTP_PASS=… SMTP_FROM=… SUPABASE_PAT=… node backend/apply-email-config.mjs');
  } else throw e;
}

const after = await api('GET', `/projects/${REF}/config/auth`);
const check = (label, cond) => console.log(`${cond ? '✅' : '❌'} ${label}`);
check(`срок кода = ${after.mailer_otp_exp} c`, after.mailer_otp_exp === 600);
check(`длина кода = ${after.mailer_otp_length}`, after.mailer_otp_length === 6);
check(`писем в час = ${after.rate_limit_email_sent}`, after.rate_limit_email_sent >= 100);
check('magic link шлёт 6-значный код', String(after.mailer_templates_magic_link_content || '').includes('{{ .Token }}'));
check('email change шлёт 6-значный код', String(after.mailer_templates_email_change_content || '').includes('{{ .Token }}'));
check('в письме подпись ORTA TEAM', String(after.mailer_templates_magic_link_content || '').includes('ORTA TEAM'));
check(`имя отправителя: ${after.smtp_sender_name || '(встроенный Supabase)'}`, !!after.smtp_sender_name);
if (!after.smtp_host) {
  console.log('\n⚠️  Свой SMTP не подключён: имя «ORTA TEAM» в поле «От кого» не появится,');
  console.log('   и Supabase ограничит отправку примерно 2–4 письмами в час на весь проект.');
}
