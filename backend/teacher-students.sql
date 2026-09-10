-- ============================================================
-- ORTA: студенты преподавателя, карточка студента и отчёты
--
-- «Свой» студент — тот, кого преподаватель хоть раз отмечал на своей паре
-- или кому ставил оценку. Чужих в списке нет.
-- ============================================================

-- Все студенты преподавателя: группа, курс, посещаемость, число оценок
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
       group by mi.student_id
    ) x
    left join profiles p on p.id = x.student_id;

  return json_build_object('ok', true, 'students', rows);
end $$;

-- Карточка одного студента: все его отметки и оценки у ЭТОГО преподавателя
create or replace function public.student_card(s_student uuid)
returns json language plpgsql security definer set search_path = public as $$
declare p record; marks json; gr json;
begin
  if not public.is_teacher() then return json_build_object('error', 'not_teacher'); end if;
  if not exists (
    select 1 from attend_marks m join attend_sessions s on s.id = m.session_id
     where s.teacher_id = auth.uid() and m.student_id = s_student
    union all
    select 1 from grades g where g.teacher_id = auth.uid() and g.student_id = s_student
  ) then return json_build_object('error', 'not_yours'); end if;

  select * into p from profiles where id = s_student;

  select coalesce(json_agg(json_build_object(
           'subject', s.subject, 'room', s.room, 'status', m.status, 'at', m.marked_at
         ) order by m.marked_at desc), '[]'::json) into marks
    from attend_marks m join attend_sessions s on s.id = m.session_id
   where s.teacher_id = auth.uid() and m.student_id = s_student;

  select coalesce(json_agg(json_build_object(
           'id', g.id, 'value', g.value, 'subject', g.subject,
           'comment', g.comment, 'created_at', g.created_at
         ) order by g.created_at desc), '[]'::json) into gr
    from grades g where g.teacher_id = auth.uid() and g.student_id = s_student;

  return json_build_object('ok', true,
    'student_id', s_student,
    'name', nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
    'group_name', p.group_name, 'course', p.course,
    'faculty', p.faculty, 'university', p.university,
    'marks', marks, 'grades', gr);
end $$;

-- Оценка вне пары: преподаватель ставит её из карточки студента,
-- поэтому предмет приходит явно, а не берётся из открытой сессии.
create or replace function public.grade_student(g_student uuid, g_subject text, g_value text, g_comment text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then return json_build_object('error', 'not_teacher'); end if;
  if coalesce(trim(g_value), '') = '' then return json_build_object('error', 'empty'); end if;
  if not exists (
    select 1 from attend_marks m join attend_sessions s on s.id = m.session_id
     where s.teacher_id = auth.uid() and m.student_id = g_student
    union all
    select 1 from grades g where g.teacher_id = auth.uid() and g.student_id = g_student
  ) then return json_build_object('error', 'not_yours'); end if;

  insert into grades (teacher_id, student_id, subject, value, comment)
    values (auth.uid(), g_student, coalesce(g_subject, ''), trim(g_value), coalesce(g_comment, ''));
  return json_build_object('ok', true);
end $$;

-- Отчёты: посещаемость по группам и по предметам + список пар с числами
create or replace function public.teacher_report()
returns json language plpgsql security definer set search_path = public as $$
declare groups json; subjects json; sessions json;
begin
  if not public.is_teacher() then return json_build_object('error', 'not_teacher'); end if;

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
     where s.teacher_id = auth.uid()
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
      left join attend_marks m on m.session_id = s.id
     where s.teacher_id = auth.uid()
     group by coalesce(nullif(s.subject, ''), 'Без названия')) t;

  select coalesce(json_agg(json_build_object(
           'id', s.id, 'subject', s.subject, 'room', s.room, 'created_at', s.created_at,
           'present', (select count(*) from attend_marks m where m.session_id = s.id and m.status = 'present'),
           'late',    (select count(*) from attend_marks m where m.session_id = s.id and m.status = 'late'),
           'absent',  (select count(*) from attend_marks m where m.session_id = s.id and m.status = 'absent')
         ) order by s.created_at desc), '[]'::json) into sessions
    from (select * from attend_sessions where teacher_id = auth.uid() order by created_at desc limit 30) s;

  return json_build_object('ok', true, 'groups', groups, 'subjects', subjects, 'sessions', sessions);
end $$;
