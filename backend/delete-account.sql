-- ============================================================
-- ORTA: удаление аккаунта из приложения
--
-- App Store Review Guideline 5.1.1(v): приложение, которое позволяет
-- завести аккаунт, обязано давать удалить его прямо из приложения.
-- Не «напишите нам», не «очистить данные на телефоне» — именно удаление
-- аккаунта и всего, что к нему привязано.
--
-- Удаляем по-настоящему: строка из auth.users уходит, а вместе с ней
-- каскадом расписание, отметки, оценки, участие в группах и посты.
-- ============================================================

create or replace function public.delete_my_account()
returns json language plpgsql security definer set search_path = public, auth as $$
declare
  me uuid := auth.uid();
  owned int;
begin
  if me is null then return json_build_object('error', 'not_signed_in'); end if;

  -- Группы, где человек староста, не должны осиротеть: передаём их
  -- самому раннему участнику, а если больше никого — удаляем группу.
  for owned in select 1 from groups where owner_id = me loop end loop;

  update groups g set owner_id = sub.user_id
    from (
      select gm.group_id, gm.user_id,
             row_number() over (partition by gm.group_id order by gm.joined_at) rn
        from group_members gm
       where gm.user_id <> me
    ) sub
   where g.owner_id = me and sub.group_id = g.id and sub.rn = 1;

  delete from groups where owner_id = me;

  -- Всё остальное уходит каскадом по внешним ключам на auth.users,
  -- но профиль и отметки на всякий случай убираем явно.
  delete from attend_marks where student_id = me;
  delete from grades where student_id = me or teacher_id = me;
  delete from attend_sessions where teacher_id = me;
  delete from lessons where user_id = me;
  delete from forum_posts where user_id = me;
  delete from profiles where id = me;

  delete from auth.users where id = me;

  return json_build_object('ok', true);
end $$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
