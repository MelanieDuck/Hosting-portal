/*
# Fix infinite recursion in RLS policies

## Problem
After adding admin policies, the RLS policies on profiles, subscriptions,
and payments tables query `profiles` to check `is_admin`. But the profiles
SELECT policy itself checks `is_admin` by querying profiles — creating
infinite recursion (Postgres error 42P17).

## Fix
1. Create a SECURITY DEFINER function `is_current_user_admin()` that checks
   the `is_admin` column on the calling user's profile row. Because it runs
   with the function owner's privileges (not the caller's RLS), it bypasses
   RLS and breaks the recursion.
2. Replace every `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)`
   in RLS policies with `public.is_current_user_admin()`.

## Security
- The function is SECURITY DEFINER with a locked search_path.
- It only reads the is_admin boolean for the current user — no data leakage.
- EXECUTE is revoked from anon; only authenticated can call it.
*/

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- ============================================================
-- PROFILES: replace recursive admin check with function call
-- ============================================================
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND (
    is_admin = (
      SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()
    ) OR public.is_current_user_admin()
  ));

-- ============================================================
-- SUBSCRIPTIONS: replace admin check
-- ============================================================
DROP POLICY IF EXISTS "select_own_subscriptions" ON subscriptions;
CREATE POLICY "select_own_subscriptions" ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "update_own_subscriptions" ON subscriptions;
CREATE POLICY "update_own_subscriptions" ON subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_current_user_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "insert_own_subscriptions" ON subscriptions;
CREATE POLICY "insert_own_subscriptions" ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "delete_own_subscriptions" ON subscriptions;
CREATE POLICY "delete_own_subscriptions" ON subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_current_user_admin());

-- ============================================================
-- PAYMENTS: replace admin check
-- ============================================================
DROP POLICY IF EXISTS "select_own_payments" ON payments;
CREATE POLICY "select_own_payments" ON payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "insert_own_payments" ON payments;
CREATE POLICY "insert_own_payments" ON payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "update_own_payments" ON payments;
CREATE POLICY "update_own_payments" ON payments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_current_user_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_current_user_admin());

DROP POLICY IF EXISTS "delete_own_payments" ON payments;
CREATE POLICY "delete_own_payments" ON payments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_current_user_admin());

-- ============================================================
-- CLIENT_NOTES: replace admin check
-- ============================================================
DROP POLICY IF EXISTS "select_notes_admin" ON client_notes;
CREATE POLICY "select_notes_admin" ON client_notes FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "insert_notes_admin" ON client_notes;
CREATE POLICY "insert_notes_admin" ON client_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "update_notes_admin" ON client_notes;
CREATE POLICY "update_notes_admin" ON client_notes FOR UPDATE
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "delete_notes_admin" ON client_notes;
CREATE POLICY "delete_notes_admin" ON client_notes FOR DELETE
  TO authenticated
  USING (public.is_current_user_admin());

-- ============================================================
-- PAYMENT_METHODS: add admin read access (was missing)
-- ============================================================
DROP POLICY IF EXISTS "select_own_payment_methods" ON payment_methods;
CREATE POLICY "select_own_payment_methods" ON payment_methods FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_current_user_admin());

-- ============================================================
-- BACKUPS: add admin read access (was missing)
-- ============================================================
DROP POLICY IF EXISTS "select_own_backups" ON backups;
CREATE POLICY "select_own_backups" ON backups FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_current_user_admin());