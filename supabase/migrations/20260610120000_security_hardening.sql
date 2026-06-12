-- ============================================================================
-- SECURITY HARDENING
--   1. Stop authenticated users from reading every other user's full row
--      (medical conditions, taste profile, stripe_customer_id, plan, etc.)
--   2. Stop users from self-escalating their own `plan` / `stripe_customer_id`
--   3. Stop users from enumerating / joining arbitrary households
--   4. Scope the "neural block" condition upsert to the owning user
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. USERS: own-row reads only, plus a safe public projection
-- ----------------------------------------------------------------------------

-- The broad "any authenticated user can read any users row" policy leaked
-- metabolic_state_json (medical data), taste_profile_json and stripe_customer_id.
drop policy if exists "Authenticated view profiles" on users;

-- "Users view own profile" (auth.uid() = id) remains the only SELECT policy,
-- so a user can read their own full row but not anyone else's.

-- Safe, public-facing projection for leaderboards, search, household and friend
-- lists. A (security definer) view bypasses the base-table RLS but only exposes
-- non-sensitive columns.
create or replace view public.public_profiles
with (security_invoker = false) as
  select id, display_name, avatar_url, streak_count, household_id, created_at
  from public.users;

grant select on public.public_profiles to authenticated;

-- ----------------------------------------------------------------------------
-- 2. USERS: prevent privilege/billing self-escalation via column grants
--    (RLS is row-level; column-level writes are controlled with GRANTs)
-- ----------------------------------------------------------------------------
revoke update on public.users from authenticated;
grant update (
  display_name,
  avatar_url,
  metabolic_state_json,
  taste_profile_json,
  hand_width_mm,
  calorie_target,
  household_id,
  updated_at
) on public.users to authenticated;
-- `plan`, `stripe_customer_id`, `streak_count`, `last_entropy_run` are now only
-- writable by the service role (Stripe webhook) and SECURITY DEFINER triggers
-- (streak / entropy), which run as the table owner and bypass column grants.

-- ----------------------------------------------------------------------------
-- 3. HOUSEHOLDS: no enumeration; join/leave go through SECURITY DEFINER RPCs
-- ----------------------------------------------------------------------------
drop policy if exists "Households read authenticated" on households;
drop policy if exists "Households read member" on households;
drop policy if exists "Households read own" on households;
create policy "Households read own" on households for select using (
  id = get_my_household_id()
);

-- Join a household by code (case-insensitive). Validates the code server-side
-- so clients never need to read the households table to discover join codes.
create or replace function public.join_household_by_code(p_code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.households;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_house
  from public.households
  where lower(join_code) = lower(btrim(p_code))
  limit 1;

  if v_house.id is null then
    raise exception 'Invalid join code';
  end if;

  update public.users set household_id = v_house.id where id = auth.uid();
  return v_house;
end;
$$;

-- Create a fresh private household and move the caller into it (used by "leave").
create or replace function public.create_private_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.households;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.households (name)
  values (coalesce(nullif(btrim(p_name), ''), 'Private Household'))
  returning * into v_house;

  update public.users set household_id = v_house.id where id = auth.uid();
  return v_house;
end;
$$;

grant execute on function public.join_household_by_code(text) to authenticated;
grant execute on function public.create_private_household(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. CONDITIONS: allow a user to upsert ONLY their own neural-block row
--    (id is always 'neural-block-<their uid>'); global conditions stay read-only.
-- ----------------------------------------------------------------------------
drop policy if exists "Users manage own neural block insert" on conditions;
create policy "Users manage own neural block insert" on conditions for insert
  with check (id = 'neural-block-' || auth.uid()::text);

drop policy if exists "Users manage own neural block update" on conditions;
create policy "Users manage own neural block update" on conditions for update
  using (id = 'neural-block-' || auth.uid()::text)
  with check (id = 'neural-block-' || auth.uid()::text);
