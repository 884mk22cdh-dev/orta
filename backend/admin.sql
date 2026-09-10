-- ============================================================
-- ORTA: админ-доступ для CRM-панели
-- Порядок: 1) в панели админки зарегистрируйтесь по email
--          2) выполните этот файл целиком в SQL Editor
-- ============================================================

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "admins: вижу себя" on public.admins;
create policy "admins: вижу себя" on public.admins for select using (auth.uid() = user_id);

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as
$$ select exists (select 1 from admins where user_id = auth.uid()) $$;

-- Доступ админа к данным (только чтение + управление афишей)
drop policy if exists "admin: читает профили" on public.profiles;
create policy "admin: читает профили" on public.profiles for select using (public.is_admin());

drop policy if exists "admin: читает группы" on public.groups;
create policy "admin: читает группы" on public.groups for select using (public.is_admin());

drop policy if exists "admin: читает участников" on public.group_members;
create policy "admin: читает участников" on public.group_members for select using (public.is_admin());

drop policy if exists "admin: читает форум" on public.forum_posts;
create policy "admin: читает форум" on public.forum_posts for select using (public.is_admin());

drop policy if exists "admin: события все" on public.events;
create policy "admin: события все" on public.events for select using (public.is_admin());
drop policy if exists "admin: события создаёт" on public.events;
create policy "admin: события создаёт" on public.events for insert with check (public.is_admin());
drop policy if exists "admin: события меняет" on public.events;
create policy "admin: события меняет" on public.events for update using (public.is_admin());
drop policy if exists "admin: события удаляет" on public.events;
create policy "admin: события удаляет" on public.events for delete using (public.is_admin());

-- Назначить админом ваш аккаунт (сначала зарегистрируйтесь в панели!)
insert into public.admins (user_id)
select id from auth.users where email = 'oscaraltyn@gmail.com'
on conflict do nothing;
