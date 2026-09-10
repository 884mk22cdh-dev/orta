-- ============================================================
-- ORTA: исправления по итогам аудита (ВАЖНО, выполнить целиком)
-- ============================================================

-- 1. ДЫРА: внутреннюю функцию начисления монет мог вызвать любой
--    (revoke от anon/authenticated не помогает — нужно снять грант с PUBLIC)
revoke execute on function public.grant_coins(uuid, text, text, int) from public;
revoke execute on function public.grant_coins(uuid, text, text, int) from anon, authenticated;

-- 2. Обнуляем следы накрутки (в т.ч. тестовой)
delete from public.coin_events where kind = 'hack';
update public.coins set balance = 50 where balance > 100000;

-- 3. Публичный профиль больше не отдаёт код группы (по нему можно было войти в чужую группу)
create or replace function public.get_public_profile(target uuid)
returns json language plpgsql security definer set search_path = public as $$
declare p record; g record;
begin
  select * into p from profiles where id = target;
  if p.id is null then return null; end if;
  select gr.name into g from group_members gm join groups gr on gr.id = gm.group_id
    where gm.user_id = target limit 1;
  return json_build_object(
    'first_name', p.first_name, 'last_name', p.last_name,
    'university', p.university, 'faculty', p.faculty,
    'course', p.course, 'group_name', p.group_name,
    'group_title', g.name);
end $$;

-- 4. Админ может видеть расписание студента (в админ-панели по тапу)
drop policy if exists "admin read lessons" on public.lessons;
create policy "admin read lessons" on public.lessons for select using (public.is_admin());

-- 5. Админ видит все push-токены (иначе уведомление уходило только ему самому)
drop policy if exists "push: админ читает все" on public.push_tokens;
create policy "push: админ читает все" on public.push_tokens for select using (public.is_admin());

-- 6. Админ может модерировать форум (удалять чужие сообщения по жалобе)
drop policy if exists "admin delete forum" on public.forum_posts;
create policy "admin delete forum" on public.forum_posts for delete using (public.is_admin());

-- 7. Описание события (если ещё не добавлено)
alter table public.events add column if not exists description text not null default '';
