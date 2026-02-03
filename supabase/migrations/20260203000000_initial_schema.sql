-- Enable necessary extensions
create extension if not exists "vector";
create extension if not exists "pg_cron";

-- USERS TABLE
create table public.users (
  id uuid references auth.users not null primary key,
  metabolic_state_json jsonb default '{}'::jsonb,
  hand_width_mm numeric,
  streak_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- FOODS TABLE
create table public.foods (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  density_coefficient numeric, -- g/cm^3
  category_decay_rate numeric, -- daily probability decay
  barcode_upc text unique,
  created_at timestamptz default now()
);

-- PANTRY TABLE
create table public.pantry (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  food_id uuid references public.foods(id),
  name text, -- fallback if food_id is null
  probability_score numeric default 1.0,
  last_verified_at timestamptz default now(),
  created_at timestamptz default now()
);

-- CONDITIONS TABLE
create table public.conditions (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  rules_json jsonb default '{}'::jsonb,
  dga_score numeric,
  never_recommend_json jsonb default '[]'::jsonb
);

-- WORKFLOWS TABLE (Auditing)
create table public.workflows (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  trigger_event text not null,
  last_run_status text,
  logs_json jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- LOGS TABLE
create table public.logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  grams numeric,
  metabolic_tags_json jsonb,
  analysis_workflow_id uuid references public.workflows(id),
  created_at timestamptz default now()
);

-- METABOLIC PHENOMENA TABLE
create table public.metabolic_phenomena (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  mechanism text,
  deepseek_prompt_template text,
  created_at timestamptz default now()
);

-- RLS POLICIES
alter table public.users enable row level security;
alter table public.pantry enable row level security;
alter table public.workflows enable row level security;
alter table public.logs enable row level security;

create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

create policy "Users can view own pantry" on public.pantry
  for select using (auth.uid() = user_id);

create policy "Users can insert into own pantry" on public.pantry
  for insert with check (auth.uid() = user_id);

create policy "Users can update own pantry" on public.pantry
  for update using (auth.uid() = user_id);

create policy "Users can delete from own pantry" on public.pantry
  for delete using (auth.uid() = user_id);

create policy "Users can view own workflows" on public.workflows
  for select using (auth.uid() = user_id);

create policy "Users can view own logs" on public.logs
  for select using (auth.uid() = user_id);
