-- ============================================================
-- ORTA: обязательное обновление приложения
--
-- Приложение при запуске и при возврате на экран читает эту таблицу.
-- Если его версия ниже min_version — показывает экран «Обновите ORTA»
-- с кнопкой в App Store и дальше не пускает. Читается без входа.
--
-- Поднять минимальную версию после выхода релиза:
--   update app_config set min_version='2.0.2', latest_version='2.0.2' where id='ios';
-- ============================================================

create table if not exists public.app_config (
  id             text primary key,
  min_version    text not null default '0.0.0',
  latest_version text not null default '0.0.0',
  store_url      text not null default 'https://apps.apple.com/kz/app/id6807105507',
  message        text not null default '',
  updated_at     timestamptz not null default now()
);
alter table public.app_config enable row level security;

drop policy if exists "app_config: читают все" on public.app_config;
create policy "app_config: читают все" on public.app_config for select using (true);
-- записи только сервисной ролью / из SQL Editor: политик на insert/update нет

insert into public.app_config (id, min_version, latest_version)
values ('ios', '2.0.1', '2.0.1')
on conflict (id) do nothing;
