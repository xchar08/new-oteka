-- ============================================================================
-- VOUCHER PREMIUM PASSES
--   Vouchers grant a time-limited 'pro' plan (e.g. type 'oteka_plus_30d' =
--   30 days). Adds users.plan_expires_at, an atomic redeem_voucher RPC, and
--   an hourly pg_cron job that downgrades expired passes. Paid (Stripe)
--   subscriptions are untouched: the webhook sets plan_expires_at = null.
-- ============================================================================

alter table users add column if not exists plan_expires_at timestamptz;

create or replace function public.redeem_voucher(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.vouchers;
  v_days int;
  v_user public.users;
  v_new_expiry timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_voucher
  from public.vouchers
  where lower(code) = lower(btrim(p_code))
  for update;

  if v_voucher.id is null then
    raise exception 'Invalid voucher code';
  end if;
  if v_voucher.is_redeemed then
    raise exception 'This voucher has already been redeemed';
  end if;
  if v_voucher.expires_at is not null and v_voucher.expires_at < now() then
    raise exception 'This voucher has expired';
  end if;

  v_days := (regexp_match(v_voucher.type, '_(\d+)d$'))[1]::int;
  if v_days is null then
    raise exception 'Unsupported voucher type: %', v_voucher.type;
  end if;

  select * into v_user from public.users where id = auth.uid() for update;

  if v_user.plan in ('pro', 'coach') and v_user.plan_expires_at is null then
    raise exception 'Your account already has full access';
  end if;

  v_new_expiry := greatest(coalesce(v_user.plan_expires_at, now()), now())
                  + make_interval(days => v_days);

  update public.users
     set plan = 'pro', plan_expires_at = v_new_expiry
   where id = auth.uid();

  update public.vouchers
     set is_redeemed = true, redeemed_by = auth.uid(), redeemed_at = now()
   where id = v_voucher.id;

  return jsonb_build_object('plan', 'pro', 'expires_at', v_new_expiry, 'days_granted', v_days);
end;
$$;

grant execute on function public.redeem_voucher(text) to authenticated;

create or replace function public.expire_premium_passes()
returns void
language sql
security definer
set search_path = public
as $$
  update public.users
     set plan = 'free', plan_expires_at = null
   where plan_expires_at is not null
     and plan_expires_at < now();
$$;

create extension if not exists pg_cron;

select cron.unschedule('expire-premium-passes')
from cron.job
where jobname = 'expire-premium-passes';

select cron.schedule(
  'expire-premium-passes',
  '15 * * * *',
  'select public.expire_premium_passes()'
);
