-- 0003: billing (plan §6). The teams row already has plan / stripe_customer_id /
-- stripe_subscription_id / seat_count (from 0001). This adds subscription status
-- + the current period end so the billing page and webhook handler can reflect
-- and gate on subscription state. plan_status is free-text (set by the Stripe
-- webhook): 'active' | 'trialing' | 'past_due' | 'canceled' | 'lifetime'.
--
-- REMOTE Supabase: apply via the dashboard SQL editor (wrapped in begin;…commit;)
-- or `supabase db push`. Idempotent — safe to re-run.

alter table public.teams
  add column if not exists plan_status text,
  add column if not exists current_period_end timestamptz;
