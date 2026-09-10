-- ============================================================
-- ORTA: форум = чат только для участников своей группы
-- ============================================================

-- Код моей группы (или null, если я не в группе)
create or replace function public.my_group_code()
returns text language sql security definer set search_path = public as $$
  select gr.code from group_members gm
    join groups gr on gr.id = gm.group_id
   where gm.user_id = auth.uid() limit 1
$$;

-- Чтение: только участники той же группы (старый ключ «вуз|группа» тоже поддержан)
drop policy if exists "forum: читает своя группа" on public.forum_posts;
drop policy if exists "forum read" on public.forum_posts;
create policy "forum read" on public.forum_posts for select using (
  group_key = public.my_group_code()
  or exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.group_name <> ''
       and (p.university || '|' || p.group_name) = forum_posts.group_key)
);

-- Запись: только в свою группу и только от своего имени
drop policy if exists "forum: пишу в свою группу" on public.forum_posts;
drop policy if exists "forum write" on public.forum_posts;
create policy "forum write" on public.forum_posts for insert with check (
  auth.uid() = user_id and (
    group_key = public.my_group_code()
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and p.group_name <> ''
         and (p.university || '|' || p.group_name) = forum_posts.group_key)
  )
);
