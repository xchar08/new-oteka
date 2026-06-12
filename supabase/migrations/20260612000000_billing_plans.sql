-- ============================================================================
-- BILLING PLANS (Stripe price allowlist)
--   Replaces the hardcoded PLAN_CONFIG placeholders in create-checkout-session
--   and the hardcoded priceIds in the pricing page. Going live (or rotating
--   prices) becomes an INSERT, not a code deploy.
-- ============================================================================

create table if not exists plans (
  price_id text primary key,          -- Stripe Price ID (price_...)
  plan_type text not null check (plan_type in ('pro', 'coach')),
  name text not null,
  seat_count int not null default 1,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

alter table plans enable row level security;

drop policy if exists "Plans readable by authenticated" on plans;
create policy "Plans readable by authenticated" on plans
  for select using (auth.role() = 'authenticated' and active);
-- No insert/update/delete policies: only the service role manages plans.

-- To go live, insert your real Stripe Price IDs (SQL editor or psql):
-- insert into plans (price_id, plan_type, name, seat_count, sort_order) values
--   ('price_XXXXXXXXXXXX', 'pro',   'Oteka Solar',  1, 1),
--   ('price_YYYYYYYYYYYY', 'coach', 'Oteka Coach', 15, 2);
