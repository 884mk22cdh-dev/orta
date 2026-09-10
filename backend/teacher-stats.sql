-- ============================================================
-- ORTA: сводка для профиля преподавателя
-- ============================================================

create or replace function public.teacher_stats()
returns json language plpgsql security definer set search_path = public as $$
declare
  p record;
  n_sessions int; n_students int; n_present int; n_late int; n_absent int; n_grades int;
  subjects json; recent json;
begin
  if not public.is_teacher() then return json_build_object('error', 'not_teacher'); end if;
  select * into p from profiles where id = auth.uid();

  select count(*) into n_sessions from attend_sessions where teacher_id = auth.uid();

  select count(distinct m.student_id) into n_students
    from attend_marks m join attend_sessions s on s.id = m.session_id
   where s.teacher_id = auth.uid();

  select
    count(*) filter (where m.status = 'present'),
    count(*) filter (where m.status = 'late'),
    count(*) filter (where m.status = 'absent')
    into n_present, n_late, n_absent
    from attend_marks m join attend_sessions s on s.id = m.session_id
   where s.teacher_id = auth.uid();

  select count(*) into n_grades from grades where teacher_id = auth.uid();

  -- разбивка по предметам: сколько пар и сколько отметок
  select coalesce(json_agg(x order by x->>'subject'), '[]'::json) into subjects
    from (
      select json_build_object(
               'subject', coalesce(nullif(s.subject, ''), 'Без названия'),
               'sessions', count(distinct s.id),
               'marks', count(m.student_id),
               'students', count(distinct m.student_id)
             ) as x
        from attend_sessions s
        left join attend_marks m on m.session_id = s.id
       where s.teacher_id = auth.uid()
       group by coalesce(nullif(s.subject, ''), 'Без названия')
    ) t;

  -- последние выставленные оценки
  select coalesce(json_agg(json_build_object(
           'value', g.value, 'subject', g.subject, 'comment', g.comment,
           'created_at', g.created_at,
           'student', trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, ''))
         ) order by g.created_at desc), '[]'::json) into recent
    from (select * from grades where teacher_id = auth.uid() order by created_at desc limit 10) g
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
