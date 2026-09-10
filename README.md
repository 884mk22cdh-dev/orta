# ORTA — приложение для студентов Казахстана

Расписание, группы со старостой, форум, афиша, задачи, ИИ-помощник, DOSS-обмен.

## Структура

- `mobile/` — приложение (Expo SDK 54, React Native, вход через Expo Go)
  - `App.js` — состояние, навигация, синк с облаком, все формы
  - `src/theme.js` — токены дизайна + тёмная тема
  - `src/data.js` — расписание, данные по умолчанию
  - `src/universities.js` — 106 вузов КЗ по 24 городам с факультетами
  - `src/screens.js` — все экраны (включая календарь, группу, DOSS, админку)
  - `src/ui.js` — компоненты (карточки, таббар, глаза миньона pull-to-refresh)
  - `src/backend.js` — клиент Supabase (профиль, расписание, форум, группы, ИИ)
  - `src/ai.js` — локальный ИИ-помощник + контекст для облачного
  - `src/i18n.js` — русский / қазақша / English
  - `src/notifications.js` — напоминания о парах + утренние/вечерние сводки
- `backend/` — SQL для Supabase (проект ORTA, https://zqjbvrfpuusemdsurskc.supabase.co)
  - `schema.sql` ✅ выполнен · `groups.sql` ✅ · `profile-link.sql` ✅
  - `admin.sql` — админ-доступ (проще активировать из приложения: Настройки → Админ-режим)
  - `ai-function.ts` — Edge Function «ai» для настоящего Claude (нужен ANTHROPIC_API_KEY)
- `admin/index.html` — веб-версия админки (бонус; основная — внутри приложения)
- `index.html` + `app.js` + `styles.css` — старая веб-версия (прототип)
- `дизайн/` — исходный макет из Claude Design

## Запуск

```bash
cd mobile && npx expo start   # QR сканировать в Expo Go (SDK 54!)
```

## Что осталось (план)

1. Активировать админку в приложении (Настройки → Админ-режим → SQL).
2. Включить облачный ИИ: задеплоить `backend/ai-function.ts` (Dashboard → Edge Functions → имя `ai`) + секрет `ANTHROPIC_API_KEY`.
3. App Store: аккаунт Apple Developer ($99/год) + аккаунт expo.dev → `eas build` → TestFlight → виджет «следующая пара» и настоящие ссылки orta://.
