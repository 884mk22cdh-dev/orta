-- ============================================================
-- ORTA: аккаунт преподавателя
--   • отмечает посещаемость: показывает QR, студенты сканируют
--   • ставит оценки
--   • видит журнал своей группы
-- ============================================================

-- 1. Роль в профиле. По умолчанию все студенты.
alter table public.profiles add column if not exists role text not null default 'student'
  check (role in ('student', 'teacher'));

create or replace function public.is_teacher()
returns boolean language sql security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'teacher') $$;

-- 2. Сессия отметки: преподаватель открыл QR на паре.
--    Код живёт минуты — переслать однокурснику в общежитие бесполезно.
create table if not exists public.attend_sessions (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  group_id   uuid references public.groups(id) on delete set null,
  subject    text not null default '',
  room       text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists attend_sessions_code on public.attend_sessions (code);
alter table public.attend_sessions enable row level security;

-- Преподаватель видит свои сессии; студенты — только через RPC по коду
drop policy if exists "sessions: свои" on public.attend_sessions;
create policy "sessions: свои" on public.attend_sessions for select
  using (auth.uid() = teacher_id);

-- 3. Отметки, поставленные преподавателем
create table if not exists public.attend_marks (
  session_id uuid not null references public.attend_sessions(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'present' check (status in ('present', 'late', 'absent')),
  marked_at  timestamptz not null default now(),
  primary key (session_id, student_id)
);
alter table public.attend_marks enable row level security;

-- Студент видит свои отметки, преподаватель — по своим сессиям
drop policy if exists "marks: свои" on public.attend_marks;
create policy "marks: свои" on public.attend_marks for select
  using (auth.uid() = student_id
         or session_id in (select id from attend_sessions where teacher_id = auth.uid()));

-- 4. Оценки
create table if not exists public.grades (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  subject    text not null default '',
  value      text not null,
  comment    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists grades_student on public.grades (student_id, created_at desc);
alter table public.grades enable row level security;

-- Студент читает свои оценки, преподаватель — те, что поставил сам
drop policy if exists "grades: свои" on public.grades;
create policy "grades: свои" on public.grades for select
  using (auth.uid() = student_id or auth.uid() = teacher_id);

drop policy if exists "grades: ставит преподаватель" on public.grades;
create policy "grades: ставит преподаватель" on public.grades for insert
  with check (auth.uid() = teacher_id and public.is_teacher());

drop policy if exists "grades: удаляет автор" on public.grades;
create policy "grades: удаляет автор" on public.grades for delete
  using (auth.uid() = teacher_id);

-- ============================================================
-- Функции
-- ============================================================

-- Стать преподавателем (пока свободно — на запуске закроем кодом вуза)
create or replace function public.become_teacher()
returns json language plpgsql security definer set search_path = public as $$
begin
  update profiles set role = 'teacher' where id = auth.uid();
  return json_build_object('ok', true, 'role', 'teacher');
end $$;

-- Открыть отметку: возвращает код для QR. Живёт заданное число минут.
create or replace function public.open_attend_session(
  s_subject text, s_room text default '', s_minutes int default 10)
returns json language plpgsql security definer set search_path = public as $$
declare c text; sid uuid; mins int;
begin
  if not public.is_teacher() then return json_build_object('error', 'not_teacher'); end if;
  mins := least(greatest(coalesce(s_minutes, 10), 1), 60);
  c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into attend_sessions (code, teacher_id, subject, room, expires_at)
    values (c, auth.uid(), coalesce(s_subject, ''), coalesce(s_room, ''), now() + (mins || ' minutes')::interval)
    returning id into sid;
  return json_build_object('id', sid, 'code', c, 'subject', s_subject,
                           'room', s_room, 'minutes', mins,
                           'expires_at', now() + (mins || ' minutes')::interval);
end $$;

-- Студент отсканировал QR преподавателя
create or replace function public.mark_by_code(s_code text)
returns json language plpgsql security definer set search_path = public as $$
declare s record; late boolean;
begin
  select * into s from attend_sessions where code = upper(trim(s_code));
  if s.id is null then return json_build_object('error', 'not_found'); end if;
  if s.expires_at < now() then return json_build_object('error', 'expired'); end if;
  if s.teacher_id = auth.uid() then return json_build_object('error', 'self'); end if;

  -- пришёл в последней трети окна — «опоздал»
  late := now() > s.created_at + (s.expires_at - s.created_at) * 0.67;

  insert into attend_marks (session_id, student_id, status)
    values (s.id, auth.uid(), case when late then 'late' else 'present' end)
    on conflict (session_id, student_id) do nothing;

  return json_build_object('ok', true, 'subject', s.subject, 'room', s.room,
                           'status', case when late then 'late' else 'present' end);
end $$;

-- Кто отметился: живой список для экрана преподавателя
create or replace function public.session_marks(s_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare rows json;
begin
  if not exists (select 1 from attend_sessions where id = s_id and teacher_id = auth.uid()) then
    return json_build_object('error', 'not_yours');
  end if;
  select coalesce(json_agg(json_build_object(
           'student_id', m.student_id,
           'name', trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
           'group_name', p.group_name, 'course', p.course,
           'status', m.status, 'at', m.marked_at) order by m.marked_at), '[]'::json)
    into rows
    from attend_marks m left join profiles p on p.id = m.student_id
   where m.session_id = s_id;
  return json_build_object('ok', true, 'marks', rows);
end $$;

-- Мои сессии за последнее время
create or replace function public.my_sessions()
returns json language plpgsql security definer set search_path = public as $$
declare rows json;
begin
  select coalesce(json_agg(json_build_object(
           'id', s.id, 'code', s.code, 'subject', s.subject, 'room', s.room,
           'created_at', s.created_at, 'expires_at', s.expires_at,
           'marks', (select count(*) from attend_marks m where m.session_id = s.id)
         ) order by s.created_at desc), '[]'::json)
    into rows from attend_sessions s
   where s.teacher_id = auth.uid() and s.created_at > now() - interval '30 days';
  return json_build_object('ok', true, 'sessions', rows);
end $$;

-- Поставить оценку
create or replace function public.give_grade(
  g_student uuid, g_subject text, g_value text, g_comment text default '')
returns json language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_teacher() then return json_build_object('error', 'not_teacher'); end if;
  if coalesce(trim(g_value), '') = '' then return json_build_object('error', 'empty'); end if;
  insert into grades (teacher_id, student_id, subject, value, comment)
    values (auth.uid(), g_student, coalesce(g_subject, ''), trim(g_value), coalesce(g_comment, ''))
    returning * into r;
  return row_to_json(r);
end $$;

-- Мои оценки (студент) — журнал, которого так не хватает в Платонусе
create or replace function public.my_grades()
returns json language plpgsql security definer set search_path = public as $$
declare rows json;
begin
  select coalesce(json_agg(json_build_object(
           'id', g.id, 'subject', g.subject, 'value', g.value, 'comment', g.comment,
           'created_at', g.created_at,
           'teacher', trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))
         ) order by g.created_at desc), '[]'::json)
    into rows from grades g left join profiles p on p.id = g.teacher_id
   where g.student_id = auth.uid();
  return json_build_object('ok', true, 'grades', rows);
end $$;

-- Мои отметки от преподавателей (студент видит, что ему проставили)
create or replace function public.my_teacher_marks()
returns json language plpgsql security definer set search_path = public as $$
declare rows json;
begin
  select coalesce(json_agg(json_build_object(
           'subject', s.subject, 'room', s.room, 'status', m.status, 'at', m.marked_at
         ) order by m.marked_at desc), '[]'::json)
    into rows from attend_marks m join attend_sessions s on s.id = m.session_id
   where m.student_id = auth.uid();
  return json_build_object('ok', true, 'marks', rows);
end $$;

alter publication supabase_realtime add table public.attend_marks;
