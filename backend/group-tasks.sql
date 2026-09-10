-- ============================================================
-- ORTA: староста публикует ДЗ и материалы на всю группу
-- ============================================================

create table if not exists public.group_tasks (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  subject     text not null default '',
  due         text not null default '',
  note        text not null default '',
  photos      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists group_tasks_group on public.group_tasks (group_id, created_at desc);
alter table public.group_tasks enable row level security;

-- Читают только участники группы
drop policy if exists "gtasks read" on public.group_tasks;
create policy "gtasks read" on public.group_tasks for select
  using (group_id in (select public.my_group_ids()));

-- Пишет и удаляет только староста своей группы
drop policy if exists "gtasks write" on public.group_tasks;
create policy "gtasks write" on public.group_tasks for insert
  with check (auth.uid() = author_id
              and group_id in (select id from public.groups where owner_id = auth.uid()));

drop policy if exists "gtasks delete" on public.group_tasks;
create policy "gtasks delete" on public.group_tasks for delete
  using (group_id in (select id from public.groups where owner_id = auth.uid()));

-- ДЗ моей группы, новые сверху
create or replace function public.my_group_tasks()
returns setof public.group_tasks language sql security definer set search_path = public as
$$ select * from group_tasks
    where group_id in (select public.my_group_ids())
    order by created_at desc limit 100 $$;

-- Опубликовать ДЗ (сервер сам подставит группу — подделать чужую нельзя)
create or replace function public.add_group_task(
  t_title text, t_subject text default '', t_due text default '',
  t_note text default '', t_photos jsonb default '[]'::jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare gid uuid; r record;
begin
  select id into gid from groups where owner_id = auth.uid() limit 1;
  if gid is null then return json_build_object('error', 'not_owner'); end if;
  if coalesce(trim(t_title), '') = '' then return json_build_object('error', 'empty'); end if;

  insert into group_tasks (group_id, author_id, title, subject, due, note, photos)
    values (gid, auth.uid(), trim(t_title), coalesce(t_subject, ''), coalesce(t_due, ''),
            coalesce(t_note, ''), coalesce(t_photos, '[]'::jsonb))
    returning * into r;
  return row_to_json(r);
end $$;

-- Материалы к ДЗ: староста может залить фото в бакет files
drop policy if exists "storage: староста загружает" on storage.objects;
create policy "storage: староста загружает" on storage.objects for insert
  with check (bucket_id = 'files'
              and exists (select 1 from public.groups where owner_id = auth.uid()));

drop policy if exists "storage: староста удаляет" on storage.objects;
create policy "storage: староста удаляет" on storage.objects for delete
  using (bucket_id = 'files'
         and exists (select 1 from public.groups where owner_id = auth.uid()));

-- Живое обновление: ДЗ появляется у группы сразу
alter publication supabase_realtime add table public.group_tasks;
