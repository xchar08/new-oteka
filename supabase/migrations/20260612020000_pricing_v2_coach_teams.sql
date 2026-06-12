-- ============================================================================
-- PRICING V2 + COACH TEAMS + AUTO-TRIAL
--   1. plans: monthly/annual intervals + display amounts (page reads prices
--      from the DB, so price tests are an INSERT, not a deploy)
--   2. New users start with an automatic 7-day Solar trial via column
--      defaults (expire_premium_passes cron already downgrades them)
--   3. Coach seat provisioning: coach_teams + join codes, seat-limited
--      join/leave, and full revocation when the coach subscription dies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PLANS V2: billing interval + display amount
-- ----------------------------------------------------------------------------
alter table plans add column if not exists billing_interval text not null default 'month'
  check (billing_interval in ('month', 'year'));
alter table plans add column if not exists amount_cents int;
alter table plans add column if not exists currency text not null default 'usd';

-- Go-live inserts (replace price_… with your real Stripe Price IDs):
-- insert into plans (price_id, plan_type, billing_interval, amount_cents, name, seat_count, sort_order) values
--   ('price_SOLAR_M', 'pro',   'month', 1299,   'Oteka Solar',  1, 1),
--   ('price_SOLAR_Y', 'pro',   'year',  7999,   'Oteka Solar',  1, 2),
--   ('price_COACH_M', 'coach', 'month', 14900,  'Oteka Coach', 15, 3),
--   ('price_COACH_Y', 'coach', 'year',  119900, 'Oteka Coach', 15, 4);

-- ----------------------------------------------------------------------------
-- 2. AUTO-TRIAL: every NEW user starts with a 7-day Solar pass.
--    Onboarding upserts never pass `plan`, so defaults apply on row creation.
--    Existing rows are untouched; the hourly cron downgrades expired trials.
-- ----------------------------------------------------------------------------
alter table users alter column plan set default 'pro';
alter table users alter column plan_expires_at set default (now() + interval '7 days');

-- ----------------------------------------------------------------------------
-- 3. COACH TEAMS (seat provisioning)
-- ----------------------------------------------------------------------------
create table if not exists coach_teams (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid not null unique references users(id) on delete cascade,
  seat_limit int not null default 15,
  join_code text unique not null default upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8)),
  created_at timestamptz default now()
);

alter table users add column if not exists coach_team_id uuid references coach_teams(id);
create index if not exists idx_users_coach_team_id on users(coach_team_id);

alter table coach_teams enable row level security;

drop policy if exists "Coach team visible to owner and members" on coach_teams;
create policy "Coach team visible to owner and members" on coach_teams for select using (
  owner_id = auth.uid()
  or id = (select coach_team_id from users where id = auth.uid())
);
-- All writes go through SECURITY DEFINER RPCs / the service role.

-- Owner: fetch (lazily creating) their team + seat usage
create or replace function public.get_my_coach_team()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.coach_teams;
  v_used int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if (select plan from public.users where id = auth.uid()) <> 'coach' then
    raise exception 'Coach plan required';
  end if;

  select * into v_team from public.coach_teams where owner_id = auth.uid();
  if v_team.id is null then
    insert into public.coach_teams (owner_id) values (auth.uid()) returning * into v_team;
  end if;

  select count(*) into v_used from public.users where coach_team_id = v_team.id;
  return jsonb_build_object(
    'join_code', v_team.join_code,
    'seat_limit', v_team.seat_limit,
    'seats_used', v_used
  );
end;
$$;
grant execute on function public.get_my_coach_team() to authenticated;

-- Athlete: claim a seat with the coach's join code
create or replace function public.join_coach_team(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me public.users;
  v_team public.coach_teams;
  v_owner public.users;
  v_used int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_me from public.users where id = auth.uid() for update;
  if v_me.plan = 'coach' then
    raise exception 'Coach accounts cannot join a team';
  end if;
  if v_me.plan = 'pro' and v_me.plan_expires_at is null and v_me.coach_team_id is null then
    raise exception 'Your account already has full access';
  end if;

  select * into v_team from public.coach_teams
   where upper(join_code) = upper(btrim(p_code))
   for update;
  if v_team.id is null then
    raise exception 'Invalid team code';
  end if;

  select * into v_owner from public.users where id = v_team.owner_id;
  if v_owner.plan <> 'coach' then
    raise exception 'This team is no longer active';
  end if;

  select count(*) into v_used from public.users
   where coach_team_id = v_team.id and id <> auth.uid();
  if v_used >= v_team.seat_limit then
    raise exception 'This team has no seats left';
  end if;

  update public.users
     set plan = 'pro', plan_expires_at = null, coach_team_id = v_team.id
   where id = auth.uid();

  return jsonb_build_object('plan', 'pro', 'team_owner', coalesce(v_owner.display_name, 'your coach'));
end;
$$;
grant execute on function public.join_coach_team(text) to authenticated;

-- Athlete: give the seat back
create or replace function public.leave_coach_team()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update public.users u
     set coach_team_id = null,
         plan_expires_at = null,
         plan = case
           when exists (select 1 from public.subscriptions s
                         where s.user_id = u.id and s.status = 'active') then u.plan
           else 'free'
         end
   where u.id = auth.uid()
     and u.coach_team_id is not null;
end;
$$;
grant execute on function public.leave_coach_team() to authenticated;

-- Service role only (Stripe webhook): tear down a team when the coach
-- subscription ends. Members with their own active subscription keep their
-- plan and are merely detached.
create or replace function public.revoke_coach_team(p_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  select id into v_team_id from public.coach_teams where owner_id = p_owner;
  if v_team_id is null then
    return;
  end if;

  update public.users u
     set plan = 'free', plan_expires_at = null
   where u.coach_team_id = v_team_id
     and not exists (select 1 from public.subscriptions s
                      where s.user_id = u.id and s.status = 'active');

  update public.users set coach_team_id = null where coach_team_id = v_team_id;
  delete from public.coach_teams where id = v_team_id;
end;
$$;
revoke execute on function public.revoke_coach_team(uuid) from public, anon, authenticated;
grant execute on function public.revoke_coach_team(uuid) to service_role;
