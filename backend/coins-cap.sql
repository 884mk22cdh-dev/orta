-- ============================================================
-- ORTA: потолок на монеты за задачи
--
-- Дыра, найденная аудитом 2026-09-02: claim_task платит +10 за каждый новый
-- task_id, а идентификаторы задач придумывает телефон. Проверить на сервере,
-- что задача настоящая, невозможно — значит нужен дневной лимит.
-- ============================================================

create or replace function public.claim_task(task_id text)
returns json language plpgsql security definer set search_path = public as $$
declare ok boolean; b int; today_tasks int;
begin
  -- сколько задач уже оплачено сегодня
  select count(*) into today_tasks
    from coin_events
   where user_id = auth.uid()
     and kind = 'task'
     and created_at >= date_trunc('day', now());

  if today_tasks >= 5 then
    select balance into b from coins where user_id = auth.uid();
    return json_build_object('ok', false, 'balance', coalesce(b, 50),
                             'reason', 'daily_limit', 'limit', 5);
  end if;

  ok := public.grant_coins(auth.uid(), 'task', task_id, 10);
  select balance into b from coins where user_id = auth.uid();
  return json_build_object('ok', ok, 'balance', coalesce(b, 50),
                           'left_today', greatest(0, 5 - today_tasks - (case when ok then 1 else 0 end)));
end $$;

-- Обнуляем то, что уже накрутили тестами (у кого больше 1000 — это точно не игра)
update public.coins set balance = 200 where balance > 1000;
