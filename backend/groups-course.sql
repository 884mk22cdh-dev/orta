-- ============================================================
-- ORTA: курс у группы + переименование группы старостой
-- Вставить целиком в SQL Editor и нажать Run
-- ============================================================

-- 1. У группы появляется курс. Заполняем существующие по курсу старосты.
alter table public.groups add column if not exists course int not null default 0;

update public.groups g
   set course = coalesce(p.course, 0)
  from public.profiles p
 where p.id = g.owner_id and g.course = 0;

-- 2. Создание группы: курс берём из профиля старосты
create or replace function public.create_group(g_name text, g_university text)
returns json language plpgsql security definer set search_path = public as $$
declare c text; gid uuid; my_course int;
begin
  select coalesce(course, 0) into my_course from profiles where id = auth.uid();
  delete from group_members where user_id = auth.uid();
  delete from groups where owner_id = auth.uid();
  c := upper(substr(md5(random()::text), 1, 6));
  insert into groups (code, name, university, owner_id, course)
    values (c, g_name, g_university, auth.uid(), coalesce(my_course, 0)) returning id into gid;
  insert into group_members (group_id, user_id, role) values (gid, auth.uid(), 'owner');
  return json_build_object('code', c, 'name', g_name, 'university', g_university,
                           'course', coalesce(my_course, 0),
                           'owner_id', auth.uid(), 'role', 'owner');
end $$;

-- 3. Вступление: курс студента должен совпасть с курсом группы.
--    Четверокурсник не попадёт в группу первого курса и наоборот.
--    Возвращаем понятную причину отказа, чтобы приложение показало её человеку.
create or replace function public.join_group(g_code text)
returns json language plpgsql security definer set search_path = public as $$
declare g record; my_course int;
begin
  select * into g from groups where code = upper(trim(g_code));
  if g.id is null then
    return json_build_object('error', 'not_found');
  end if;

  select coalesce(course, 0) into my_course from profiles where id = auth.uid();

  -- староста всегда может вернуться в свою группу
  if g.owner_id <> auth.uid()
     and coalesce(g.course, 0) > 0
     and coalesce(my_course, 0) > 0
     and coalesce(g.course, 0) <> coalesce(my_course, 0) then
    return json_build_object('error', 'course_mismatch',
                             'group_course', g.course, 'my_course', my_course);
  end if;

  delete from group_members where user_id = auth.uid() and group_id <> g.id;
  insert into group_members (group_id, user_id, role)
    values (g.id, auth.uid(), case when g.owner_id = auth.uid() then 'owner' else 'member' end)
    on conflict do nothing;
  return json_build_object('code', g.code, 'name', g.name, 'university', g.university,
                           'course', g.course, 'owner_id', g.owner_id,
                           'role', case when g.owner_id = auth.uid() then 'owner' else 'member' end);
end $$;

-- 4. Моя группа — отдаём и курс
create or replace function public.my_group()
returns json language plpgsql security definer set search_path = public as $$
declare g record;
begin
  select gr.*, gm.role into g
    from group_members gm join groups gr on gr.id = gm.group_id
    where gm.user_id = auth.uid() limit 1;
  if g.id is null then return null; end if;
  return json_build_object('code', g.code, 'name', g.name, 'university', g.university,
                           'course', g.course, 'owner_id', g.owner_id, 'role', g.role);
end $$;

-- 5. Староста может переименовать свою группу (после правки профиля)
create or replace function public.rename_group(g_name text)
returns json language plpgsql security definer set search_path = public as $$
declare g record;
begin
  update groups set name = coalesce(nullif(trim(g_name), ''), name)
   where owner_id = auth.uid()
   returning * into g;
  if g.id is null then return null; end if;
  return json_build_object('code', g.code, 'name', g.name, 'university', g.university,
                           'course', g.course, 'owner_id', g.owner_id, 'role', 'owner');
end $$;

-- 6. Курс старосты меняется — группа едет за ним
create or replace function public.set_group_course(g_course int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update groups set course = greatest(0, coalesce(g_course, 0)) where owner_id = auth.uid();
end $$;
