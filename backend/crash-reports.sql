-- ============================================================
-- ORTA: отчёты о падениях
--
-- Без этого падение на телефоне пользователя не оставляет следа:
-- человек видит белый экран, удаляет приложение, и мы никогда
-- не узнаём почему. Сторонний сервис не заводим — пишем к себе,
-- смотреть их будет админ.
-- ============================================================

create table if not exists public.crash_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  message      text not null,
  stack        text,
  screen       text,
  app_version  text,
  platform     text,
  is_fatal     boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists crash_reports_time_idx on public.crash_reports (created_at desc);

alter table public.crash_reports enable row level security;

-- Писать может любой вошедший — но только от своего имени.
drop policy if exists crash_insert on public.crash_reports;
create policy crash_insert on public.crash_reports
  for insert with check (user_id is null or user_id = auth.uid());

-- Читать — только админ. Обычный пользователь не должен видеть
-- чужие стеки: там мелькают имена экранов и данные.
drop policy if exists crash_read_admin on public.crash_reports;
create policy crash_read_admin on public.crash_reports
  for select using (public.is_admin());

-- Приём отчёта. Ограничиваем длину: стек с телефона бывает огромным,
-- а от него нужны только верхние кадры.
create or replace function public.report_crash(
  c_message text, c_stack text, c_screen text, c_version text, c_platform text, c_fatal boolean)
returns json language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if coalesce(trim(c_message), '') = '' then return json_build_object('error', 'empty'); end if;

  -- защита от лавины: одно и то же падение в цикле не должно залить таблицу
  select count(*) into recent from crash_reports
   where user_id = auth.uid() and created_at > now() - interval '1 minute';
  if recent >= 5 then return json_build_object('ok', true, 'skipped', true); end if;

  insert into crash_reports (user_id, message, stack, screen, app_version, platform, is_fatal)
    values (auth.uid(), left(c_message, 500), left(c_stack, 4000), left(c_screen, 80),
            left(c_version, 20), left(c_platform, 20), coalesce(c_fatal, true));
  return json_build_object('ok', true);
end $$;

-- Список для админского экрана: свежие падения, одинаковые — сгруппированы
create or replace function public.crash_list()
returns json language plpgsql security definer set search_path = public as $$
declare rows json;
begin
  if not public.is_admin() then return json_build_object('error', 'not_admin'); end if;
  select coalesce(json_agg(x order by (x->>'last')::timestamptz desc), '[]'::json) into rows from (
    select json_build_object(
             'message', message,
             'screen', max(screen),
             'version', max(app_version),
             'platform', max(platform),
             'count', count(*),
             'users', count(distinct user_id),
             'last', max(created_at),
             'stack', (array_agg(stack order by created_at desc))[1]) as x
      from crash_reports
     where created_at > now() - interval '30 days'
     group by message
     limit 50) t;
  return json_build_object('ok', true, 'crashes', rows);
end $$;
