/*
# Add Stripe data columns to pending_clients and create account activation function

## Overview
The Stripe webhook captures payment data into `stripe_subscriptions` (keyed by Stripe customer_id),
but the client dashboard reads from `subscriptions` and `payments` (keyed by user_id). These are
disconnected — payments succeed but never appear on the dashboard. This migration bridges the gap:

1. Adds columns to `pending_clients` to store Stripe customer ID and plan details captured at
   checkout completion time (by the webhook).
2. Creates a SECURITY DEFINER function `activate_pending_client` that runs when a client sets
   their password after payment. It:
   - Looks up the pending client by email
   - Creates a `stripe_customers` row linking the new auth user to the Stripe customer
   - Creates a `subscriptions` row (the table the dashboard reads) with plan/amount/currency/billing_cycle
   - Creates a `payments` row for the initial checkout payment
   - Updates the pending client status to 'activated'
   - Returns the created user_id so the frontend can sign them in

## New Columns on `pending_clients`
- `stripe_customer_id` (text, nullable) — Stripe customer ID from checkout
- `plan_name` (text, nullable) — plan name captured at checkout
- `plan_amount` (numeric, nullable) — amount in major currency units
- `plan_currency` (text, nullable) — 3-letter ISO currency code
- `billing_cycle` (text, nullable) — 'monthly' or 'yearly'

## New Function: `activate_pending_client`
- Parameters: `p_email` (the client's email, used to find the pending client)
- Returns: `user_id` (uuid) of the newly created auth user
- Security: SECURITY DEFINER, executes with service-role privileges so it can insert into
  `stripe_customers`, `subscriptions`, and `payments` which normally require the authenticated
  user to own the row. Called from the frontend after signUp, using the new session's JWT.
- The function does NOT create the auth user — `supabase.auth.signUp()` does that. This function
  is called after signUp succeeds, to wire up the subscription/payment records.

## RLS
- No policy changes. `pending_clients` remains admin-only (via is_current_user_admin()).
  The new function is SECURITY DEFINER so it bypasses RLS to do the wiring.
- `stripe_customers`, `subscriptions`, `payments` keep their existing owner-scoped RLS.
  The function inserts with the correct `user_id` so the new user can read their own data.
*/

-- Add Stripe data columns to pending_clients
ALTER TABLE public.pending_clients
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS plan_name text,
  ADD COLUMN IF NOT EXISTS plan_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS plan_currency text,
  ADD COLUMN IF NOT EXISTS billing_cycle text;

-- Create the activation function
-- This is called from the frontend after the user has completed signUp (which creates the auth.users row).
-- It wires up the Stripe customer link + subscription + payment records using the Stripe data
-- captured by the webhook on the pending_clients row.
CREATE OR REPLACE FUNCTION public.activate_pending_client(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pending RECORD;
  v_user_id uuid;
  v_subscription_id uuid;
  v_now timestamptz := now();
BEGIN
  -- Find the pending client by email (case-insensitive) with Stripe data
  SELECT * INTO v_pending
  FROM pending_clients
  WHERE lower(email) = lower(p_email)
    AND stripe_customer_id IS NOT NULL
    AND status = 'completed'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No completed pending client found with Stripe data for email %', p_email;
  END IF;

  -- Get the auth user id matching this email
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found for email %', p_email;
  END IF;

  -- Link the Stripe customer to the new auth user
  INSERT INTO stripe_customers (user_id, customer_id)
  VALUES (v_user_id, v_pending.stripe_customer_id)
  ON CONFLICT (user_id) DO UPDATE
    SET customer_id = excluded.customer_id,
        updated_at = now(),
        deleted_at = NULL;

  -- Create the subscription record (what the dashboard reads)
  INSERT INTO subscriptions (
    user_id, plan_name, status, billing_cycle, amount, currency,
    started_at, next_payment_date
  )
  VALUES (
    v_user_id,
    COALESCE(v_pending.plan_name, 'Hosting Plan'),
    'active',
    COALESCE(v_pending.billing_cycle, 'monthly'),
    COALESCE(v_pending.plan_amount, 0),
    COALESCE(v_pending.plan_currency, 'gbp'),
    v_now,
    (v_now + INTERVAL '1 month')::date
  )
  RETURNING id INTO v_subscription_id;

  -- Create the initial payment record
  INSERT INTO payments (
    user_id, subscription_id, amount, currency, status,
    payment_date, description, is_one_off
  )
  VALUES (
    v_user_id,
    v_subscription_id,
    COALESCE(v_pending.plan_amount, 0),
    COALESCE(v_pending.plan_currency, 'gbp'),
    'succeeded',
    v_now,
    'Initial subscription payment',
    false
  );

  -- Mark pending client as fully activated
  UPDATE pending_clients
  SET status = 'activated', updated_at = v_now
  WHERE id = v_pending.id;

  RETURN v_user_id;
END;
$$;

-- Revoke from anon, grant to authenticated (the function is called by the newly-signed-up user)
REVOKE ALL ON FUNCTION public.activate_pending_client(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_pending_client(text) TO authenticated;
