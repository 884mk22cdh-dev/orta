-- ============================================================
-- ORTA: присутствие — «в сети» для админки
--
-- Приложение раз в минуту, пока открыто, вызывает touch_presence().
-- Админ видит «в сети», если отметка свежее 2 минут, иначе «был(а) N назад».
-- Курс и дата регистрации уже есть в admin_students.
-- ============================================================

create table if not exists public.presence (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  seen_at   timestamptz not null default now(),
  version   text not null default ''
);
alter table public.presence enable row level security;
drop policy if exists "presence: своё" on public.presence;
create policy "presence: своё" on public.presence for select using (auth.uid() = user_id);

create or replace function public.touch_presence(app_version text default '')
returns void language sql security definer set search_path = public as $$
  insert into presence (user_id, seen_at, version) values (auth.uid(), now(), coalesce(app_version, ''))
  on conflict (user_id) do update set seen_at = now(), version = excluded.version
$$;
revoke all on function public.touch_presence(text) from public;
grant execute on function public.touch_presence(text) to authenticated;

-- admin_students: добавляем seen_at и версию приложения
drop function if exists public.admin_students(text, int);
create or replace function public.admin_students(search text default '', lim int default 500)
returns table (
  id uuid, email text, first_name text, last_name text, phone text,
  university text, faculty text, course int, group_name text, role text,
  created_at timestamptz, last_sign_in_at timestamptz, seen_at timestamptz, app_version text,
  lessons int, in_group boolean, coins int, streak int, push boolean
)
language sql security definer set search_path = public, auth as $$
  select u.id, u.email, p.first_name, p.last_name, p.phone,
         p.university, p.faculty, p.course, p.group_name, coalesce(p.role, 'student'),
         u.created_at, u.last_sign_in_at, pr.seen_at, coalesce(pr.version, ''),
         (select count(*)::int from lessons l where l.user_id = u.id),
         exists(select 1 from group_members gm where gm.user_id = u.id),
         coalesce(c.balance, 0), coalesce(c.streak, 0),
         exists(select 1 from push_tokens t where t.user_id = u.id)
    from auth.users u
    left join profiles p on p.id = u.id
    left join coins c on c.user_id = u.id
    left join presence pr on pr.user_id = u.id
   where public.is_admin()
     and u.email is not null
     and u.email not like '%@orta.kz'
     and (search = '' or u.email ilike '%' || search || '%'
          or coalesce(p.first_name, '') ilike '%' || search || '%'
          or coalesce(p.last_name, '') ilike '%' || search || '%'
          or coalesce(p.university, '') ilike '%' || search || '%')
   order by u.created_at desc
   limit lim
$$;
revoke all on function public.admin_students(text, int) from public;
grant execute on function public.admin_students(text, int) to authenticated;

-- сводка: сколько в сети прямо сейчас
create or replace function public.admin_summary()
returns json language sql security definer set search_path = public, auth as $$
  select case when public.is_admin() then json_build_object(
    'students', (select count(*) from auth.users where email is not null and email not like '%@orta.kz'),
    'anonymous', (select count(*) from auth.users where is_anonymous),
    'online', (select count(*) from presence pr join auth.users u on u.id = pr.user_id where u.email is not null and pr.seen_at > now() - interval '2 minutes'),
    'active_24h', (select count(*) from auth.users where email is not null and last_sign_in_at > now() - interval '24 hours'),
    'active_7d', (select count(*) from auth.users where email is not null and last_sign_in_at > now() - interval '7 days'),
    'new_7d', (select count(*) from auth.users where email is not null and created_at > now() - interval '7 days'),
    'with_push', (select count(*) from push_tokens),
    'by_course', (select json_agg(json_build_object('course', course, 'n', n) order by course) from (
        select coalesce(p.course, 0) course, count(*) n from profiles p join auth.users u on u.id = p.id
         where u.email is not null and u.email not like '%@orta.kz' group by 1) x)
  ) else null end
$$;
revoke all on function public.admin_summary() from public;
grant execute on function public.admin_summary() to authenticated;
