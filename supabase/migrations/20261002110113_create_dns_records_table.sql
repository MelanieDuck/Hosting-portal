/*
# Create dns_records table for client hosting details

## Overview
Replaces the single-value "Server" and "IP Address" fields on the profile
with two structured DNS records (Type, Host/Name, Value) that the merchant
fills in per-client. The client sees these read-only on their dashboard.

## New Table
- `dns_records`
  - `id` (uuid, primary key)
  - `user_id` (uuid, FK to auth.users, ON DELETE CASCADE) — which client this record belongs to
  - `record_type` (text) — e.g. A, CNAME, MX, TXT
  - `host_name` (text) — the host/name portion, e.g. "@" or "www"
  - `record_value` (text) — the value, e.g. an IP or target domain
  - `sort_order` (int, default 0) — keeps the two records in a stable order
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

## Security
- RLS enabled.
- Clients (authenticated) can SELECT their own records.
- Admins (is_current_user_admin()) can SELECT, INSERT, UPDATE, DELETE any record.
- No client-side INSERT/UPDATE/DELETE — only admins manage DNS records.
*/

CREATE TABLE IF NOT EXISTS dns_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type text NOT NULL DEFAULT 'A',
  host_name text NOT NULL DEFAULT '@',
  record_value text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE dns_records ENABLE ROW LEVEL SECURITY;

-- Clients can read their own DNS records
DROP POLICY IF EXISTS "select_own_dns_records" ON dns_records;
CREATE POLICY "select_own_dns_records" ON dns_records FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_current_user_admin());

-- Only admins can insert
DROP POLICY IF EXISTS "insert_dns_records_admin" ON dns_records;
CREATE POLICY "insert_dns_records_admin" ON dns_records FOR INSERT
  TO authenticated WITH CHECK (public.is_current_user_admin());

-- Only admins can update
DROP POLICY IF EXISTS "update_dns_records_admin" ON dns_records;
CREATE POLICY "update_dns_records_admin" ON dns_records FOR UPDATE
  TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

-- Only admins can delete
DROP POLICY IF EXISTS "delete_dns_records_admin" ON dns_records;
CREATE POLICY "delete_dns_records_admin" ON dns_records FOR DELETE
  TO authenticated USING (public.is_current_user_admin());

-- Index for lookups by user
CREATE INDEX IF NOT EXISTS idx_dns_records_user_id ON dns_records(user_id);
