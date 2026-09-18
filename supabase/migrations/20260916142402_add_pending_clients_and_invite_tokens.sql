/*
# Pending Clients + Invite Tokens

## Problem
The profiles table references auth.users(id), so we can't create a profile
row without a Supabase Auth account. We need a separate table to store
pending client records before they sign up.

## Schema
1. pending_clients — stores client data before they complete signup
   - id (uuid PK, gen_random_uuid — NOT tied to auth.users)
   - full_name, email, notes
   - status: 'pending' | 'invited' | 'completed'
   - created_by (references auth.users — the admin who added them)
   - created_at, updated_at

2. invite_tokens — secure one-time-use tokens for client setup links
   - id (uuid PK)
   - token (uuid, unique — the hard-to-guess token in the URL)
   - client_id (references pending_clients.id)
   - created_by (references auth.users — the admin)
   - expires_at (defaults to 7 days from creation)
   - used_at (null until the client completes setup)
   - created_at

## Security
- RLS enabled on both tables
- Only admins can SELECT/INSERT/UPDATE (via is_current_user_admin())
- The token column is not exposed via the client SDK — only the admin
  who created it sees the link. The setup page will validate the token
  server-side.
*/

-- ============================================================
-- PENDING_CLIENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS pending_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pending_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_admin_pending_clients" ON pending_clients;
CREATE POLICY "select_admin_pending_clients" ON pending_clients FOR SELECT
  TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "insert_admin_pending_clients" ON pending_clients;
CREATE POLICY "insert_admin_pending_clients" ON pending_clients FOR INSERT
  TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "update_admin_pending_clients" ON pending_clients;
CREATE POLICY "update_admin_pending_clients" ON pending_clients FOR UPDATE
  TO authenticated USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "delete_admin_pending_clients" ON pending_clients;
CREATE POLICY "delete_admin_pending_clients" ON pending_clients FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- ============================================================
-- INVITE_TOKENS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES pending_clients(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_admin_invite_tokens" ON invite_tokens;
CREATE POLICY "select_admin_invite_tokens" ON invite_tokens FOR SELECT
  TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "insert_admin_invite_tokens" ON invite_tokens;
CREATE POLICY "insert_admin_invite_tokens" ON invite_tokens FOR INSERT
  TO authenticated WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "update_admin_invite_tokens" ON invite_tokens;
CREATE POLICY "update_admin_invite_tokens" ON invite_tokens FOR UPDATE
  TO authenticated USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "delete_admin_invite_tokens" ON invite_tokens;
CREATE POLICY "delete_admin_invite_tokens" ON invite_tokens FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pending_clients_status ON pending_clients(status);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_client_id ON invite_tokens(client_id);

-- updated_at trigger for pending_clients
DROP TRIGGER IF EXISTS pending_clients_updated_at ON pending_clients;
CREATE TRIGGER pending_clients_updated_at BEFORE UPDATE ON pending_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();