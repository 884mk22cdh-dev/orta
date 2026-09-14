-- ============================================================
-- ORTA: событие студента видит весь его университет
--
-- Раньше событие, созданное студентом, видел только он сам (политика
-- «вижу общие и свои»), а всем показывались только события админа.
-- Теперь у события есть университет, и его видят все студенты этого вуза.
-- Университет берётся из профиля — подставить чужой нельзя.
-- ============================================================

alter table public.events add column if not exists university text;

create index if not exists events_university_idx on public.events (university);

drop policy if exists "events: вижу общие и свои" on public.events;
create policy "events: вижу общие, свои и своего вуза" on public.events for select
  using (
    user_id is null
    or auth.uid() = user_id
    or (university is not null and university <> ''
        and university = (select p.university from public.profiles p where p.id = auth.uid()))
  );

drop policy if exists "events: создаю свои" on public.events;
create policy "events: создаю свои" on public.events for insert
  with check (
    auth.uid() = user_id
    and (university is null or university = ''
         or university = (select p.university from public.profiles p where p.id = auth.uid()))
  );
