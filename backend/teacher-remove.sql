-- ============================================================
-- ORTA: преподаватель убирает лишнее
--
-- Исключение студента — мягкое и обратимое: отметки и оценки остаются
-- в базе, студент по-прежнему видит свою посещаемость у себя. Просто
-- преподаватель больше не держит его в своём списке (ушёл с курса,
-- перевёлся, зашёл на пару случайно).
--
-- Оценка и пара удаляются насовсем — их ставит сам преподаватель,
-- и ошибиться он может только в свою сторону.
-- ============================================================

create table if not exists public.teacher_excluded (
  teacher_id  uuid not null references auth.users(id) on delete cascade,
  student_id  uuid not null references auth.users(id) on delete cascade,
  excluded_at timestamptz not null default now(),
  primary key (teacher_id, student_id)
);

alter table public.teacher_excluded enable row level security;

drop policy if exists teacher_excluded_own on public.teacher_excluded;
create policy teacher_excluded_own on public.teacher_excluded
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- Убрать студента из своего списка
create or replace function public.exclude_student(s_student uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then return json_build_object('error', 'not_teacher'); end if;
  if not exists (
    select 1 from attend_marks m join attend_sessions s on s.id = m.session_id
     where s.teacher_id = auth.uid() and m.student_id = s_student
    union all
    select 1 from grades g where g.teacher_id = auth.uid() and g.student_id = s_student
  ) then return json_build_object('error', 'not_yours'); end if;

  insert into teacher_excluded (teacher_id, student_id) values (auth.uid(), s_student)
    on conflict do nothing;
  return json_build_object('ok', true);
end $$;

-- Вернуть обратно
create or replace function public.include_student(s_student uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then return json_build_object('error', 'not_teacher'); end if;
  delete from teacher_excluded where teacher_id = auth.uid() and student_id = s_student;
  return json_build_object('ok', true);
end $$;

-- Кого преподаватель исключил — чтобы было куда нажать «вернуть»
create or replace function public.excluded_students()
returns json language plpgsql security definer set search_path = public as $$
declare rows json;
begin
  if not public.is_teacher() then return json_build_object('error', 'not_teacher'); end if;
  select coalesce(json_agg(json_build_object(
           'student_id', e.student_id,
           'name', nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
           'group_name', p.group_name, 'course', p.course
         ) order by p.group_name nulls last, p.last_name nulls last), '[]'::json)
    into rows
    from teacher_excluded e left join profiles p on p.id = e.student_id
   where e.teacher_id = auth.uid();
  return json_build_object('ok', true, 'students', rows);
end $$;

-- Удалить оценку, поставленную по ошибке
create or replace function public.delete_grade(g_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_teacher() then return json_build_object('error', 'not_teacher'); end if;
  delete from grades where id = g_id and teacher_id = auth.uid();
  get diagnostics n = row_count;
  if n = 0 then return json_build_object('error', 'not_yours'); end if;
  return json_build_object('ok', true);
end $$;

-- Удалить свою пару из журнала. Отметки по ней уходят каскадом.
create or replace function public.delete_session(s_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_teacher() then return json_build_object('error', 'not_teacher'); end if;
  delete from attend_sessions where id = s_id and teacher_id = auth.uid();
  get diagnostics n = row_count;
  if n = 0 then return json_build_object('error', 'not_yours'); end if;
  return json_build_object('ok', true);
end $$;

-- ─── исключённые пропадают из всех экранов преподавателя ───

create or replace function public.my_students()
returns json language plpgsql security definer set search_path = public as $$
declare rows json;
begin
  if not public.is_teacher() then return json_build_object('error', 'not_teacher'); end if;

  with mine as (
    select m.student_id from attend_marks m
      join attend_sessions s on s.id = m.session_id
     where s.teacher_id = auth.uid()
    union
    select g.student_id from grades g where g.teacher_id = auth.uid()
  )
  select coalesce(json_agg(json_build_object(
           'student_id', x.student_id,
           'name', nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
           'group_name', p.group_name, 'course', p.course, 'faculty', p.faculty,
           'present', x.present, 'late', x.late, 'absent', x.absent,
           'grades', x.grades, 'last_seen', x.last_seen
         ) order by p.group_name nulls last, p.last_name nulls last, p.first_name nulls last), '[]'::json)
    into rows
    from (
      select mi.student_id,
             count(*) filter (where m.status = 'present') as present,
             count(*) filter (where m.status = 'late')    as late,
             count(*) filter (where m.status = 'absent')  as absent,
             (select count(*) from grades g where g.teacher_id = auth.uid() and g.student_id = mi.student_id) as grades,
             max(m.marked_at) as last_seen
        from mine mi
        left join attend_marks m on m.student_id = mi.student_id
             and m.session_id in (select id from attend_sessions where teacher_id = auth.uid())
       where mi.student_id not in (select student_id from teacher_excluded where teacher_id = auth.uid())
       group by mi.student_id
    ) x
    left join profiles p on p.id = x.student_id;

  return json_build_object('ok', true, 'students', rows);
end $$;

create or replace function public.teacher_report()
returns json language plpgsql security definer set search_path = public as $$
declare groups json; subjects json; sessions json; ex uuid[];
begin
  if not public.is_teacher() then return json_build_object('error', 'not_teacher'); end if;
  select coalesce(array_agg(student_id), '{}') into ex from teacher_excluded where teacher_id = auth.uid();

  select coalesce(json_agg(x order by x->>'group_name'), '[]'::json) into groups from (
    select json_build_object(
             'group_name', coalesce(nullif(p.group_name, ''), 'Без группы'),
             'students', count(distinct m.student_id),
             'present', count(*) filter (where m.status = 'present'),
             'late',    count(*) filter (where m.status = 'late'),
             'absent',  count(*) filter (where m.status = 'absent')) as x
      from attend_marks m
      join attend_sessions s on s.id = m.session_id
      left join profiles p on p.id = m.student_id
     where s.teacher_id = auth.uid() and not (m.student_id = any(ex))
     group by coalesce(nullif(p.group_name, ''), 'Без группы')) t;

  select coalesce(json_agg(x order by x->>'subject'), '[]'::json) into subjects from (
    select json_build_object(
             'subject', coalesce(nullif(s.subject, ''), 'Без названия'),
             'sessions', count(distinct s.id),
             'students', count(distinct m.student_id),
             'present', count(*) filter (where m.status = 'present'),
             'late',    count(*) filter (where m.status = 'late'),
             'absent',  count(*) filter (where m.status = 'absent')) as x
      from attend_sessions s
      left join attend_marks m on m.session_id = s.id and not (m.student_id = any(ex))
     where s.teacher_id = auth.uid()
     group by coalesce(nullif(s.subject, ''), 'Без названия')) t;

  select coalesce(json_agg(json_build_object(
           'id', s.id, 'subject', s.subject, 'room', s.room, 'created_at', s.created_at,
           'present', (select count(*) from attend_marks m where m.session_id = s.id and m.status = 'present' and not (m.student_id = any(ex))),
           'late',    (select count(*) from attend_marks m where m.session_id = s.id and m.status = 'late'    and not (m.student_id = any(ex))),
           'absent',  (select count(*) from attend_marks m where m.session_id = s.id and m.status = 'absent'  and not (m.student_id = any(ex)))
         ) order by s.created_at desc), '[]'::json) into sessions
    from (select * from attend_sessions where teacher_id = auth.uid() order by created_at desc limit 30) s;

  return json_build_object('ok', true, 'groups', groups, 'subjects', subjects, 'sessions', sessions);
end $$;

create or replace function public.teacher_stats()
returns json language plpgsql security definer set search_path = public as $$
declare
  p record;
  n_sessions int; n_students int; n_present int; n_late int; n_absent int; n_grades int;
  subjects json; recent json; ex uuid[];
begin
  if not public.is_teacher() then return json_build_object('error', 'not_teacher'); end if;
  select * into p from profiles where id = auth.uid();
  select coalesce(array_agg(student_id), '{}') into ex from teacher_excluded where teacher_id = auth.uid();

  select count(*) into n_sessions from attend_sessions where teacher_id = auth.uid();

  select count(distinct m.student_id) into n_students
    from attend_marks m join attend_sessions s on s.id = m.session_id
   where s.teacher_id = auth.uid() and not (m.student_id = any(ex));

  select
    count(*) filter (where m.status = 'present'),
    count(*) filter (where m.status = 'late'),
    count(*) filter (where m.status = 'absent')
    into n_present, n_late, n_absent
    from attend_marks m join attend_sessions s on s.id = m.session_id
   where s.teacher_id = auth.uid() and not (m.student_id = any(ex));

  select count(*) into n_grades from grades
   where teacher_id = auth.uid() and not (student_id = any(ex));

  select coalesce(json_agg(x order by x->>'subject'), '[]'::json) into subjects
    from (
      select json_build_object(
               'subject', coalesce(nullif(s.subject, ''), 'Без названия'),
               'sessions', count(distinct s.id),
               'marks', count(m.student_id),
               'students', count(distinct m.student_id)
             ) as x
        from attend_sessions s
        left join attend_marks m on m.session_id = s.id and not (m.student_id = any(ex))
       where s.teacher_id = auth.uid()
       group by coalesce(nullif(s.subject, ''), 'Без названия')
    ) t;

  select coalesce(json_agg(json_build_object(
           'value', g.value, 'subject', g.subject, 'comment', g.comment,
           'created_at', g.created_at,
           'student', trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, ''))
         ) order by g.created_at desc), '[]'::json) into recent
    from (select * from grades where teacher_id = auth.uid() and not (student_id = any(ex))
           order by created_at desc limit 10) g
    left join profiles pr on pr.id = g.student_id;

  return json_build_object(
    'ok', true,
    'name', trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
    'university', coalesce(p.university, ''),
    'sessions', coalesce(n_sessions, 0),
    'students', coalesce(n_students, 0),
    'present', coalesce(n_present, 0),
    'late', coalesce(n_late, 0),
    'absent', coalesce(n_absent, 0),
    'grades', coalesce(n_grades, 0),
    'subjects', subjects,
    'recent_grades', recent);
end $$;
