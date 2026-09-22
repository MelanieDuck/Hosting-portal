/*
# Add website_url column to pending_clients and update activation function

## Overview
Adds an optional `website_url` column to `pending_clients` so admins can set a
client's website address at invite time. When the client activates their account,
the `activate_pending_client` function now copies this value into `profiles.website_url`,
which is what the client dashboard displays under "Website address".

## Changes
1. `pending_clients.website_url` (text, nullable) — optional website address set by admin.
2. `activate_pending_client` function updated: after creating subscription/payment records,
   if the pending client has a non-null `website_url`, update `profiles.website_url`
   for the newly created auth user.

## Security
- No RLS policy changes. `pending_clients` remains admin-only.
- The `activate_pending_client` function is SECURITY DEFINER and already verifies
  the caller's email matches `p_email` via `auth.email()`.
*/

ALTER TABLE public.pending_clients
  ADD COLUMN IF NOT EXISTS website_url text;

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
  IF lower(auth.email()) IS DISTINCT FROM lower(p_email) THEN
    RAISE EXCEPTION 'You can only activate your own account';
  END IF;

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

  -- If the admin set a website URL on the pending client, copy it to the profile
  IF v_pending.website_url IS NOT NULL AND trim(v_pending.website_url) <> '' THEN
    UPDATE profiles
    SET website_url = v_pending.website_url, updated_at = v_now
    WHERE id = v_user_id;
  END IF;

  -- Mark pending client as fully activated
  UPDATE pending_clients
  SET status = 'activated', updated_at = v_now
  WHERE id = v_pending.id;

  RETURN v_user_id;
END;
$$;

-- Preserve grants after recreating the function
REVOKE ALL ON FUNCTION public.activate_pending_client(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_pending_client(text) TO authenticated;
