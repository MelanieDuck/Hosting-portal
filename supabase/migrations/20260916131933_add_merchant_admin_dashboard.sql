/*
# Merchant Admin Dashboard — Schema

## Overview
Adds admin/merchant support to the hosting portal. A merchant (admin) can log in
and see a list of all clients with their subscription status, payment history,
contact details, hosting info, and notes about agreements.

## Changes

### Modified Tables
1. **profiles** — add `is_admin` boolean column (default false) to identify merchant accounts
2. **payments** — add `is_one_off` boolean column (default false) and `note` text column
   to support one-off payments for additional jobs

### New Tables
1. **client_notes** — notes the merchant writes about each client
   - id (uuid, PK)
   - user_id (uuid, references auth.users) — the client the note is about
   - author_id (uuid, references auth.users) — the admin who wrote it
   - content (text) — the note content
   - created_at, updated_at (timestamps)

### Security
- `is_admin` column is only writable via service role (not via client RLS)
- client_notes: admins can CRUD all notes; clients cannot see notes at all
- payments: admins can read all payments; clients still only see their own
- subscriptions: admins can read all subscriptions; clients still only see their own
- profiles: admins can read all profiles; clients still only see their own

## Notes
1. The `is_admin` column has RLS that prevents clients from setting it on themselves.
2. One-off payments are flagged with `is_one_off = true` and can have a description.
3. An admin test user is created separately via SQL.
*/

-- ============================================================
-- ADD is_admin TO profiles
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Admins can read ALL profiles; clients can only read their own
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- Clients can still only update their own profile (not is_admin — controlled by RLS)
-- The update policy already exists and checks auth.uid() = id, which is correct.
-- But we need to prevent clients from setting is_admin via UPDATE
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND (
    -- Either the is_admin value is unchanged, or the user is already an admin
    is_admin = (
      SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
    )
  ));

-- ============================================================
-- ADD is_one_off AND note TO payments
-- ============================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_one_off boolean NOT NULL DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS note text;

-- Admins can read ALL payments; clients still only see their own
DROP POLICY IF EXISTS "select_own_payments" ON payments;
CREATE POLICY "select_own_payments" ON payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- Admins can insert payments for any user; clients can only insert their own
DROP POLICY IF EXISTS "insert_own_payments" ON payments;
CREATE POLICY "insert_own_payments" ON payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- Admins can update any payment; clients only their own
DROP POLICY IF EXISTS "update_own_payments" ON payments;
CREATE POLICY "update_own_payments" ON payments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ))
  WITH CHECK (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- ============================================================
-- ADMIN READ ACCESS FOR SUBSCRIPTIONS
-- ============================================================
DROP POLICY IF EXISTS "select_own_subscriptions" ON subscriptions;
CREATE POLICY "select_own_subscriptions" ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- Admins can update any subscription (e.g. change status)
DROP POLICY IF EXISTS "update_own_subscriptions" ON subscriptions;
CREATE POLICY "update_own_subscriptions" ON subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ))
  WITH CHECK (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- Admins can insert subscriptions for any user
DROP POLICY IF EXISTS "insert_own_subscriptions" ON subscriptions;
CREATE POLICY "insert_own_subscriptions" ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- ============================================================
-- CLIENT_NOTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

-- Only admins can see notes
DROP POLICY IF EXISTS "select_notes_admin" ON client_notes;
CREATE POLICY "select_notes_admin" ON client_notes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- Only admins can create notes
DROP POLICY IF EXISTS "insert_notes_admin" ON client_notes;
CREATE POLICY "insert_notes_admin" ON client_notes FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- Only admins can update notes
DROP POLICY IF EXISTS "update_notes_admin" ON client_notes;
CREATE POLICY "update_notes_admin" ON client_notes FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- Only admins can delete notes
DROP POLICY IF EXISTS "delete_notes_admin" ON client_notes;
CREATE POLICY "delete_notes_admin" ON client_notes FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ));

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_client_notes_user_id ON client_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_is_one_off ON payments(is_one_off);

-- ============================================================
-- UPDATED_AT TRIGGER FOR client_notes
-- ============================================================
DROP TRIGGER IF EXISTS client_notes_updated_at ON client_notes;
CREATE TRIGGER client_notes_updated_at BEFORE UPDATE ON client_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();