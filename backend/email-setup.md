# Письма ORTA: код входа от «ORTA TEAM»

Проект: https://supabase.com/dashboard/project/zqjbvrfpuusemdsurskc

## Статус на 2 сентября 2026

| Что | Состояние |
|---|---|
| Срок жизни кода = 120 секунд | ✅ применено через Management API |
| Смена почты без письма на старый адрес | ✅ применено |
| Шаблоны с шестизначным кодом | ⛔ **заблокировано Supabase** |
| Отправитель «ORTA TEAM» | ⛔ требует своего SMTP |

**Supabase отвечает дословно:** «Email template modification is not available for
free tier projects using the default email provider. Please upgrade your plan or
configure a custom SMTP provider».

То есть **свой SMTP обязателен** — это не улучшение, а условие работы входа.
Пока его нет, письмо приходит со ссылкой, а приложение ждёт код, и новый
студент не сможет завершить регистрацию.

Второй, не менее жёсткий довод: встроенный отправитель Supabase шлёт примерно
**2–4 письма в час на весь проект**. Даже десяток регистраций в день он не
вывезет.

---

## 1. Шаблоны писем — применяются автоматически ПОСЛЕ подключения SMTP

По умолчанию Supabase шлёт ссылку (`{{ .ConfirmationURL }}`), а приложение ждёт
шестизначный код (`{{ .Token }}`). Скрипт
[apply-email-config.mjs](apply-email-config.mjs) ставит правильные шаблоны сам —
но только когда SMTP уже подключён. Ниже те же шаблоны, если захотите вставить
руками.

**Authentication → Emails → Templates**

Отредактировать нужно **два** шаблона:

| Шаблон | Когда уходит |
|---|---|
| **Magic Link** | вход со второго телефона |
| **Change Email Address** | регистрация — привязка почты в конце онбординга |

В обоих: Subject и тело — ниже. Тело одинаковое для обоих шаблонов.

### Subject
```
Ваш код в ORTA — {{ .Token }}
```

### Message body (HTML)
```html
<div style="margin:0;padding:32px 16px;background:#F1F2F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
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
        <div style="font-size:36px;font-weight:800;letter-spacing:10px;color:#5324B0;font-variant-numeric:tabular-nums;">{{ .Token }}</div>
        <div style="font-size:12.5px;color:#7C7489;margin-top:8px;">Код действует 2 минуты</div>
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
</div>
```

---

## 2. Срок жизни кода — 120 секунд

**Authentication → Emails → «Email OTP Expiration»** → поставить `120`.

Сейчас по умолчанию 3600 (час). В приложении таймер и так 2 минуты,
но без этой настройки просроченный код сервер всё ещё примет.

---

## 3. SMTP — то, без чего вход не работает

Быстрее всего **Brevo**: 300 писем в день бесплатно и **не нужен свой домен** —
достаточно подтвердить любую свою почту как отправителя.

1. Регистрация: https://www.brevo.com → подтвердить свою почту.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: имя `ORTA TEAM`,
   адрес — ваша почта. Подтвердить письмом.
3. **SMTP & API → SMTP**: там будут `Login` и `SMTP key` (пароль). Хост
   `smtp-relay.brevo.com`, порт `587`.

Альтернативы: Resend (3 000 писем/мес, но нужен свой домен),
SendGrid (100 писем/день).

Когда данные есть, всё применяется одной командой — шаблоны, отправитель и срок
кода разом:

```bash
cd "/Users/oscaraltynbekov/новый проект "
SUPABASE_PAT=sbp_xxx \
SMTP_HOST=smtp-relay.brevo.com \
SMTP_PORT=587 \
SMTP_USER=ваш-логин-из-brevo \
SMTP_PASS=ваш-smtp-ключ \
SMTP_FROM=ваша-подтверждённая@почта \
node backend/apply-email-config.mjs
```

Скрипт после применения сам перечитает конфиг и покажет галочками, что реально
встало.

---

## Проверка

1. Пройти онбординг до шага «О себе», ввести почту → нажать «Получить код».
2. Письмо должно прийти с кодом из шести цифр (не ссылкой).
3. Ввести код → попасть на главную.
4. На втором телефоне: «У меня уже есть аккаунт» → та же почта → код → должны
   подтянуться профиль, расписание, группа и монеты.
