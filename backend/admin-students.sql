-- ============================================================
-- ORTA: список студентов для админки — с почтой и активностью
--
-- Почта лежит в auth.users, куда приложение напрямую не ходит. Функция
-- отдаёт её только админу (проверка is_admin внутри), вместе с датой
-- регистрации, последним входом, вузом, группой и числом пар.
-- Анонимные аккаунты (бросили регистрацию на почте) не показываем.
-- ============================================================

create or replace function public.admin_students(search text default '', lim int default 200)
returns table (
  id uuid, email text, first_name text, last_name text, phone text,
  university text, faculty text, course int, group_name text, role text,
  created_at timestamptz, last_sign_in_at timestamptz,
  lessons int, in_group boolean, coins int, streak int, push boolean
)
language sql security definer set search_path = public, auth as $$
  select u.id, u.email, p.first_name, p.last_name, p.phone,
         p.university, p.faculty, p.course, p.group_name, coalesce(p.role, 'student'),
         u.created_at, u.last_sign_in_at,
         (select count(*)::int from lessons l where l.user_id = u.id),
         exists(select 1 from group_members gm where gm.user_id = u.id),
         coalesce(c.balance, 0), coalesce(c.streak, 0),
         exists(select 1 from push_tokens t where t.user_id = u.id)
    from auth.users u
    left join profiles p on p.id = u.id
    left join coins c on c.user_id = u.id
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

-- Сводка для шапки админки: сколько всего, сколько бросили на почте, активность
create or replace function public.admin_summary()
returns json language sql security definer set search_path = public, auth as $$
  select case when public.is_admin() then json_build_object(
    'students', (select count(*) from auth.users where email is not null and email not like '%@orta.kz'),
    'anonymous', (select count(*) from auth.users where is_anonymous),
    'active_24h', (select count(*) from auth.users where email is not null and last_sign_in_at > now() - interval '24 hours'),
    'active_7d', (select count(*) from auth.users where email is not null and last_sign_in_at > now() - interval '7 days'),
    'new_7d', (select count(*) from auth.users where email is not null and created_at > now() - interval '7 days'),
    'with_push', (select count(*) from push_tokens),
    'universities', (select json_agg(json_build_object('name', university, 'n', n)) from (
        select p.university, count(*) n from profiles p join auth.users u on u.id = p.id
         where u.email is not null and u.email not like '%@orta.kz' and coalesce(p.university,'') <> ''
         group by p.university order by n desc limit 10) x)
  ) else null end
$$;
revoke all on function public.admin_summary() from public;
grant execute on function public.admin_summary() to authenticated;
