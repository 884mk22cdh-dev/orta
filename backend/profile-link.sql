-- ORTA: публичная визитка профиля по ссылке (вставить в SQL Editor и Run)
create or replace function public.get_public_profile(target uuid)
returns json language plpgsql security definer set search_path = public as $$
declare p record; g record;
begin
  select * into p from profiles where id = target;
  if p.id is null then return null; end if;
  select gr.code, gr.name into g
    from group_members gm join groups gr on gr.id = gm.group_id
    where gm.user_id = target limit 1;
  return json_build_object(
    'first_name', p.first_name, 'last_name', p.last_name,
    'university', p.university, 'faculty', p.faculty,
    'course', p.course, 'group_name', p.group_name,
    'group_code', g.code, 'group_title', g.name);
end $$;
