-- ============================================================
-- ORTA: индексы под запросы преподавателя
--
-- my_students / student_card / teacher_report / teacher_stats фильтруют
-- по teacher_id и по student_id. Без индексов это полный перебор таблицы
-- на каждый заход на вкладку. Пока строк сотня — незаметно, на вузе — нет.
-- ============================================================

-- «мои пары», всегда свежие сверху
create index if not exists attend_sessions_teacher_idx
  on public.attend_sessions (teacher_id, created_at desc);

-- «мои оценки» и лента последних оценок в профиле
create index if not exists grades_teacher_idx
  on public.grades (teacher_id, created_at desc);

-- отметки конкретного студента: первичный ключ (session_id, student_id)
-- по одному student_id не работает — нужен свой индекс
create index if not exists attend_marks_student_idx
  on public.attend_marks (student_id);

analyze public.attend_sessions;
analyze public.attend_marks;
analyze public.grades;
