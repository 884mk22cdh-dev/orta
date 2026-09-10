-- ============================================================
-- ORTA: фото в афише + пуш-уведомления студентам
-- Вставить целиком в SQL Editor и нажать Run
-- ============================================================

-- 1. Фотографии события (массив публичных ссылок)
alter table public.events add column if not exists photos jsonb not null default '[]'::jsonb;

-- 2. Токены устройств для пуш-уведомлений
create table if not exists public.push_tokens (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  token      text not null,
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;

drop policy if exists "push: свой токен" on public.push_tokens;
create policy "push: свой токен" on public.push_tokens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push: админ читает все" on public.push_tokens;
create policy "push: админ читает все" on public.push_tokens for select
  using (public.is_admin());

-- 3. Загрузка фото афиши в хранилище (бакет files) — только админ
drop policy if exists "storage: админ загружает" on storage.objects;
create policy "storage: админ загружает" on storage.objects for insert
  with check (bucket_id = 'files' and public.is_admin());

drop policy if exists "storage: админ удаляет" on storage.objects;
create policy "storage: админ удаляет" on storage.objects for delete
  using (bucket_id = 'files' and public.is_admin());

drop policy if exists "storage: все читают" on storage.objects;
create policy "storage: все читают" on storage.objects for select
  using (bucket_id = 'files');
