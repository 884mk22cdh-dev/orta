-- ============================================================
-- ORTA: доводка аккаунта преподавателя
--   1) у преподавателя нет курса — ограничение «1..4» ему не подходит
--   2) become_teacher рапортовал об успехе, даже если профиля не было
-- ============================================================

-- 1. Курс обязателен только для студентов
alter table public.profiles drop constraint if exists profiles_course_check;
alter table public.profiles add constraint profiles_course_check
  check ((role = 'teacher' and course >= 0) or (course >= 1 and course <= 4));

-- 2. Честная функция: заводит профиль, если его нет, и возвращает правду
create or replace function public.become_teacher(t_first text default '', t_last text default '')
returns json language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into profiles (id, first_name, last_name, course, role)
    values (auth.uid(), coalesce(nullif(trim(t_first), ''), 'Преподаватель'),
            coalesce(t_last, ''), 0, 'teacher')
    on conflict (id) do update set role = 'teacher',
      first_name = coalesce(nullif(trim(t_first), ''), profiles.first_name),
      last_name  = coalesce(nullif(trim(t_last), ''), profiles.last_name);

  select count(*) into n from profiles where id = auth.uid() and role = 'teacher';
  if n = 0 then return json_build_object('error', 'failed'); end if;
  return json_build_object('ok', true, 'role', 'teacher');
end $$;

-- Обратно в студенты (на случай ошибки при выборе роли)
create or replace function public.become_student()
returns json language plpgsql security definer set search_path = public as $$
begin
  update profiles set role = 'student', course = greatest(1, course) where id = auth.uid();
  return json_build_object('ok', true, 'role', 'student');
end $$;

-- 3. Моя роль — приложению нужно знать, что рисовать
create or replace function public.my_role()
returns json language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select role into r from profiles where id = auth.uid();
  return json_build_object('role', coalesce(r, 'student'));
end $$;
