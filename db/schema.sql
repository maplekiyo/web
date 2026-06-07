-- AtelierM bookkeeping schema (Postgres / Supabase).
-- Run in the Supabase SQL editor, or via `psql $DATABASE_URL -f db/schema.sql`.

create extension if not exists "pgcrypto";

-- Households are implicit via members.household_no.
create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  household_no integer,
  role        text,                 -- 役職
  full_name   text not null,        -- 氏名
  kana        text,                 -- なまえ
  address     text,
  phone       text,
  email       text,
  school      text,                 -- 勤務先・学校名
  birthday    text,                 -- 誕生日 (free text as in the sheet)
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists member_nicknames (
  id        uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  nickname  text not null,
  unique (nickname)
);

create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  fiscal_year   integer not null,        -- e.g. 2026
  session_date  date not null,
  activity_name text,                     -- 活動内容
  room_fee      integer not null default 600,  -- 部屋代
  sort_order    integer not null default 0,
  unique (fiscal_year, session_date)
);

create table if not exists attendance (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references sessions(id) on delete cascade,
  member_id      uuid not null references members(id) on delete cascade,
  status         text not null default 'present' check (status in ('present','absent')),
  membership_fee integer not null default 0,  -- 会費
  unique (session_id, member_id)
);

-- A memo = one handwritten image (one person, one session).
create table if not exists memos (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid references sessions(id) on delete set null,
  member_id      uuid references members(id) on delete set null,
  image_path     text,                  -- Supabase Storage path
  ocr_raw        jsonb,                 -- raw model output
  declared_total integer,               -- 合計 as written
  status         text not null default 'draft'
                 check (status in ('draft','confirmed','posted')),
  created_at     timestamptz not null default now()
);

create table if not exists memo_lines (
  id         uuid primary key default gen_random_uuid(),
  memo_id    uuid not null references memos(id) on delete cascade,
  part_name  text not null,
  unit_price integer not null,
  quantity   integer not null,
  amount     integer not null,
  note       text not null default 'none' check (note in ('ア','ひ','other','none')),
  line_order integer not null default 0
);

create table if not exists fiscal_settings (
  fiscal_year         integer primary key,
  prior_year_balance  integer not null default 0,  -- 前年度残高
  difference          integer not null default 0,  -- 差額
  default_room_fee    integer not null default 600
);

create index if not exists idx_memos_session on memos(session_id);
create index if not exists idx_memo_lines_memo on memo_lines(memo_id);
create index if not exists idx_attendance_session on attendance(session_id);
