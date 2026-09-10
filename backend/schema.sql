-- ============================================================
-- ORTA — схема базы данных Supabase (отдельный проект, не Zanger AI)
-- Вставить целиком в SQL Editor нового проекта и выполнить (Run).
-- ============================================================

-- ---------- Профили ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name  text not null default '',
  phone      text not null default '',
  city       text not null default '',
  university text not null default '',
  faculty    text not null default '',
  course     int  not null default 1 check (course between 1 and 4),
  group_name text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: читаю своё"  on public.profiles for select using (auth.uid() = id);
create policy "profiles: создаю своё" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: меняю своё"  on public.profiles for update using (auth.uid() = id);

-- ---------- Расписание (одна строка = одна пара) ----------
create table public.lessons (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        smallint not null check (day between 0 and 5),  -- 0=Пн … 5=Сб
  start_time text not null,
  end_time   text not null,
  name       text not null check (char_length(name) <= 120),
  room       text not null default '',
  teacher    text not null default '',
  color      text not null default '#6C4FE0',
  type       text not null default 'Лекция',
  cancelled  boolean not null default false,
  created_at timestamptz not null default now()
);
create index lessons_user_day on public.lessons (user_id, day);
alter table public.lessons enable row level security;
create policy "lessons: свои" on public.lessons for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Заметки к парам (материалы / ДЗ / заметки) ----------
create table public.lesson_notes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  lesson_key text not null,
  field      text not null check (field in ('materials', 'hw', 'notes')),
  body       text not null default '' check (char_length(body) <= 4000),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_key, field)
);
alter table public.lesson_notes enable row level security;
create policy "notes: свои" on public.lesson_notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Афиша (user_id = null — общие события вуза) ----------
create table public.events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  title      text not null check (char_length(title) <= 200),
  date_text  text not null default '',
  place      text not null default '',
  color      text not null default '#6C4FE0',
  icon       text not null default 'ticket',
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
create policy "events: вижу общие и свои" on public.events for select
  using (user_id is null or auth.uid() = user_id);
create policy "events: создаю свои" on public.events for insert with check (auth.uid() = user_id);
create policy "events: удаляю свои" on public.events for delete using (auth.uid() = user_id);

-- ---------- Экзамены ----------
create table public.exams (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  subject    text not null check (char_length(subject) <= 120),
  date_text  text not null default '',
  time_text  text not null default '',
  room       text not null default '',
  color      text not null default '#6C4FE0',
  created_at timestamptz not null default now()
);
alter table public.exams enable row level security;
create policy "exams: свои" on public.exams for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Форум группы (общий для «университет|группа») ----------
create table public.forum_posts (
  id         uuid primary key default gen_random_uuid(),
  group_key  text not null,                 -- 'университет|группа'
  user_id    uuid not null references auth.users(id) on delete cascade,
  author     text not null default 'Студент',
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index forum_group_time on public.forum_posts (group_key, created_at desc);
alter table public.forum_posts enable row level security;
create policy "forum: читает своя группа" on public.forum_posts for select using (
  exists (select 1 from public.profiles p
          where p.id = auth.uid()
            and (p.university || '|' || p.group_name) = forum_posts.group_key)
);
create policy "forum: пишу в свою группу" on public.forum_posts for insert with check (
  auth.uid() = user_id and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.university || '|' || p.group_name) = forum_posts.group_key)
);
create policy "forum: удаляю своё" on public.forum_posts for delete using (auth.uid() = user_id);

-- ---------- DOSS: обмен расписанием по 6-значному коду ----------
create table public.schedule_shares (
  code       text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour'
);
alter table public.schedule_shares enable row level security;
create policy "shares: свои" on public.schedule_shares for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Сгенерировать код для передачи своего расписания
create or replace function public.create_share_code()
returns text language plpgsql security definer set search_path = public as $$
declare new_code text;
begin
  new_code := upper(substr(md5(random()::text), 1, 6));
  delete from schedule_shares where user_id = auth.uid();
  insert into schedule_shares (code, user_id) values (new_code, auth.uid());
  return new_code;
end $$;

-- Получить чужое расписание по коду (не зная user_id)
create or replace function public.get_shared_schedule(share_code text)
returns setof public.lessons language sql security definer set search_path = public as $$
  select l.* from lessons l
  join schedule_shares s on s.user_id = l.user_id
  where s.code = upper(share_code) and s.expires_at > now();
$$;

-- Живое обновление форума
alter publication supabase_realtime add table public.forum_posts;
