-- ============================================================
-- ORTA: группы со старостой (вставить в SQL Editor и Run)
-- ============================================================

create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  name       text not null default '',
  university text not null default '',
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.groups enable row level security;

create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_members enable row level security;

-- Хелперы (security definer — обходят рекурсию RLS)
create or replace function public.my_group_ids()
returns setof uuid language sql security definer set search_path = public as
$$ select group_id from group_members where user_id = auth.uid() $$;

create or replace function public.my_group_owner_ids()
returns setof uuid language sql security definer set search_path = public as
$$ select gm.user_id from group_members gm
   where gm.role = 'owner' and gm.group_id in (select public.my_group_ids()) $$;

create policy "groups: видят участники" on public.groups for select
  using (id in (select public.my_group_ids()));
create policy "members: вижу свою группу" on public.group_members for select
  using (group_id in (select public.my_group_ids()));

-- Группа видит расписание старосты
create policy "lessons: расписание старосты группы" on public.lessons for select
  using (user_id in (select public.my_group_owner_ids()));

-- Создать группу (я — староста). Пользователь может быть только в одной группе.
create or replace function public.create_group(g_name text, g_university text)
returns json language plpgsql security definer set search_path = public as $$
declare c text; gid uuid;
begin
  delete from group_members where user_id = auth.uid();
  delete from groups where owner_id = auth.uid();
  c := upper(substr(md5(random()::text), 1, 6));
  insert into groups (code, name, university, owner_id)
    values (c, g_name, g_university, auth.uid()) returning id into gid;
  insert into group_members (group_id, user_id, role) values (gid, auth.uid(), 'owner');
  return json_build_object('code', c, 'name', g_name, 'university', g_university,
                           'owner_id', auth.uid(), 'role', 'owner');
end $$;

-- Вступить по коду
create or replace function public.join_group(g_code text)
returns json language plpgsql security definer set search_path = public as $$
declare g record;
begin
  select * into g from groups where code = upper(trim(g_code));
  if g.id is null then return null; end if;
  delete from group_members where user_id = auth.uid() and group_id <> g.id;
  insert into group_members (group_id, user_id, role)
    values (g.id, auth.uid(), case when g.owner_id = auth.uid() then 'owner' else 'member' end)
    on conflict do nothing;
  return json_build_object('code', g.code, 'name', g.name, 'university', g.university,
                           'owner_id', g.owner_id,
                           'role', case when g.owner_id = auth.uid() then 'owner' else 'member' end);
end $$;

-- Моя группа (null, если не состою)
create or replace function public.my_group()
returns json language plpgsql security definer set search_path = public as $$
declare g record; r text;
begin
  select gr.*, gm.role into g
    from group_members gm join groups gr on gr.id = gm.group_id
    where gm.user_id = auth.uid() limit 1;
  if g.id is null then return null; end if;
  return json_build_object('code', g.code, 'name', g.name, 'university', g.university,
                           'owner_id', g.owner_id, 'role', g.role);
end $$;

-- Выйти из группы (староста при выходе распускает группу)
create or replace function public.leave_group()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from groups where owner_id = auth.uid();
  delete from group_members where user_id = auth.uid();
end $$;

-- Расписание старосты моей группы
create or replace function public.get_group_schedule()
returns setof public.lessons language sql security definer set search_path = public as
$$ select l.* from lessons l where l.user_id in (select public.my_group_owner_ids()) $$;

-- Живое обновление расписания группы
alter publication supabase_realtime add table public.lessons;
