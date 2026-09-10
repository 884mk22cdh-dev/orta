-- ============================================================
-- ORTA Coin: облачный баланс, серия дней, рефералы, бонусы старосте
-- Вставить целиком в SQL Editor и нажать Run
-- ============================================================

-- Баланс и серия
create table if not exists public.coins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  balance     int not null default 50,
  streak      int not null default 0,
  last_daily  date,
  updated_at  timestamptz not null default now()
);
alter table public.coins enable row level security;
drop policy if exists "coins: своё" on public.coins;
create policy "coins: своё" on public.coins for select using (auth.uid() = user_id);

-- Журнал начислений: ключ гарантирует, что одно и то же не начислится дважды
create table if not exists public.coin_events (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,
  ref        text not null default '',
  amount     int  not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
alter table public.coin_events enable row level security;
drop policy if exists "events: свои" on public.coin_events;
create policy "events: свои" on public.coin_events for select using (auth.uid() = user_id);

-- Внутреннее начисление (только из функций, клиент вызвать не может)
create or replace function public.grant_coins(target uuid, k text, r text, amt int)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into coin_events (user_id, kind, ref, amount) values (target, k, r, amt);
  insert into coins (user_id, balance) values (target, 50 + amt)
    on conflict (user_id) do update set balance = coins.balance + amt, updated_at = now();
  return true;
exception when unique_violation then
  return false;  -- уже начисляли — тихо пропускаем
end $$;
revoke execute on function public.grant_coins(uuid, text, text, int) from anon, authenticated;

-- Мой баланс
create or replace function public.my_coins()
returns json language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from coins where user_id = auth.uid();
  if c.user_id is null then
    insert into coins (user_id) values (auth.uid()) on conflict do nothing;
    return json_build_object('balance', 50, 'streak', 0, 'claimed_today', false);
  end if;
  return json_build_object('balance', c.balance, 'streak', c.streak,
                           'claimed_today', c.last_daily = current_date);
end $$;

-- Ежедневный вход + серия (1 раз в сутки; серия рвётся при пропуске)
create or replace function public.claim_daily()
returns json language plpgsql security definer set search_path = public as $$
declare c record; new_streak int; bonus int; total int;
begin
  insert into coins (user_id) values (auth.uid()) on conflict do nothing;
  select * into c from coins where user_id = auth.uid() for update;
  if c.last_daily = current_date then
    return json_build_object('ok', false, 'balance', c.balance, 'streak', c.streak, 'earned', 0);
  end if;
  new_streak := case when c.last_daily = current_date - 1 then c.streak + 1 else 1 end;
  bonus := case when new_streak % 7 = 0 then 50 else 0 end;  -- каждый 7-й день
  total := 2 + bonus;
  update coins set balance = balance + total, streak = new_streak,
                   last_daily = current_date, updated_at = now()
   where user_id = auth.uid();
  insert into coin_events (user_id, kind, ref, amount)
    values (auth.uid(), 'daily', current_date::text, total) on conflict do nothing;
  return json_build_object('ok', true, 'balance', c.balance + total,
                           'streak', new_streak, 'earned', total, 'week_bonus', bonus > 0);
end $$;

-- Начисление за задачу (сервер, а не телефон)
create or replace function public.claim_task(task_id text)
returns json language plpgsql security definer set search_path = public as $$
declare ok boolean; b int;
begin
  ok := public.grant_coins(auth.uid(), 'task', task_id, 10);
  select balance into b from coins where user_id = auth.uid();
  return json_build_object('ok', ok, 'balance', coalesce(b, 50));
end $$;

-- Приглашение друга: +100 обоим, один раз, себя пригласить нельзя
create or replace function public.claim_referral(inviter uuid)
returns json language plpgsql security definer set search_path = public as $$
declare b int; ok boolean;
begin
  if inviter is null or inviter = auth.uid() then
    return json_build_object('ok', false, 'reason', 'self');
  end if;
  if not exists (select 1 from auth.users where id = inviter) then
    return json_build_object('ok', false, 'reason', 'no_user');
  end if;
  -- приглашённый может засчитать реферала только один раз в жизни
  ok := public.grant_coins(auth.uid(), 'referral_joined', '', 100);
  if ok then
    perform public.grant_coins(inviter, 'referral_invited', auth.uid()::text, 100);
  end if;
  select balance into b from coins where user_id = auth.uid();
  return json_build_object('ok', ok, 'balance', coalesce(b, 50));
end $$;

-- Бонусы старосте: +20 за каждого участника (единожды) и +30 в неделю за ведение расписания
create or replace function public.claim_owner_bonus()
returns json language plpgsql security definer set search_path = public as $$
declare g record; m record; got int := 0; b int;
begin
  select gr.* into g from groups gr
    join group_members gm on gm.group_id = gr.id and gm.user_id = auth.uid() and gm.role = 'owner'
   limit 1;
  if g.id is null then
    select balance into b from coins where user_id = auth.uid();
    return json_build_object('ok', false, 'reason', 'not_owner', 'balance', coalesce(b, 50));
  end if;
  for m in select user_id from group_members where group_id = g.id and user_id <> auth.uid() loop
    if public.grant_coins(auth.uid(), 'owner_member', m.user_id::text, 20) then got := got + 20; end if;
  end loop;
  if exists (select 1 from lessons where user_id = auth.uid() limit 1) then
    if public.grant_coins(auth.uid(), 'owner_weekly',
        to_char(current_date, 'IYYY-IW'), 30) then got := got + 30; end if;
  end if;
  select balance into b from coins where user_id = auth.uid();
  return json_build_object('ok', true, 'earned', got, 'balance', coalesce(b, 50));
end $$;
