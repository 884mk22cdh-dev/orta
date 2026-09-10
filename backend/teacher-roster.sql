-- ============================================================
-- ORTA: преподаватель ставит отметки руками и видит весь список
--
-- Отметки живут ПО СЕССИЯМ: не отметился на первой паре — она так и
-- останется неотмеченной, даже если на второй он отсканировал QR.
-- ============================================================

-- Отметка вручную: пришёл / опоздал / не пришёл
create or replace function public.set_mark(s_session uuid, s_student uuid, s_status text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from attend_sessions where id = s_session and teacher_id = auth.uid()) then
    return json_build_object('error', 'not_yours');
  end if;
  if s_status is null or s_status = '' then
    delete from attend_marks where session_id = s_session and student_id = s_student;
    return json_build_object('ok', true, 'status', null);
  end if;
  if s_status not in ('present', 'late', 'absent') then
    return json_build_object('error', 'bad_status');
  end if;
  insert into attend_marks (session_id, student_id, status)
    values (s_session, s_student, s_status)
    on conflict (session_id, student_id) do update set status = excluded.status, marked_at = now();
  return json_build_object('ok', true, 'status', s_status);
end $$;

-- Список для экрана преподавателя: все, кого он уже вёл по этому предмету,
-- плюс те, кто отсканировал прямо сейчас. Кто не отметился — виден с пустым статусом.
create or replace function public.session_roster(s_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare subj text; rows json;
begin
  select subject into subj from attend_sessions where id = s_id and teacher_id = auth.uid();
  if subj is null and not exists (select 1 from attend_sessions where id = s_id and teacher_id = auth.uid()) then
    return json_build_object('error', 'not_yours');
  end if;

  with seen as (
    -- все студенты, отмечавшиеся у этого преподавателя по этому предмету
    select distinct m.student_id
      from attend_marks m
      join attend_sessions s on s.id = m.session_id
     where s.teacher_id = auth.uid() and s.subject = subj
    union
    select m.student_id from attend_marks m where m.session_id = s_id
  )
  select coalesce(json_agg(json_build_object(
           'student_id', se.student_id,
           'name', nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
           'group_name', p.group_name, 'course', p.course,
           'status', cur.status, 'at', cur.marked_at
         ) order by p.group_name nulls last, p.last_name nulls last, p.first_name nulls last), '[]'::json)
    into rows
    from seen se
    left join profiles p on p.id = se.student_id
    left join attend_marks cur on cur.session_id = s_id and cur.student_id = se.student_id;

  return json_build_object('ok', true, 'subject', subj, 'roster', rows);
end $$;

-- Оценки, которые преподаватель поставил по предмету — чтобы видеть их рядом со списком
create or replace function public.subject_grades(g_subject text)
returns json language plpgsql security definer set search_path = public as $$
declare rows json;
begin
  select coalesce(json_agg(json_build_object(
           'id', g.id, 'student_id', g.student_id, 'value', g.value,
           'comment', g.comment, 'created_at', g.created_at
         ) order by g.created_at desc), '[]'::json)
    into rows from grades g
   where g.teacher_id = auth.uid() and g.subject = coalesce(g_subject, '');
  return json_build_object('ok', true, 'grades', rows);
end $$;
