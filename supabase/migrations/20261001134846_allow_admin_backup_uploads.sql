/*
# Allow admins to upload and manage backups for any client

## Overview
Currently the backups table and storage bucket only allow users to manage
their own backups. The merchant/admin needs to upload website backup files
on behalf of clients from the admin dashboard. This migration updates RLS
policies so that admin users can insert, delete, and read backups for any
client, and can upload/download/delete files in the backups storage bucket
for any user's folder.

## Changes
1. **backups table INSERT policy** — admins can now insert backup records
   for any user_id (not just their own).
2. **backups table DELETE policy** — admins can now delete backup records
   for any user.
3. **storage.objects SELECT policy** — admins can read any file in the
   backups bucket, not just their own folder.
4. **storage.objects INSERT policy** — admins can upload to any user's
   folder in the backups bucket.
5. **storage.objects DELETE policy** — admins can delete any file in the
   backups bucket.
*/

-- Backups table: allow admin insert
DROP POLICY IF EXISTS "insert_own_backups" ON backups;
CREATE POLICY "insert_own_backups" ON backups FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_current_user_admin());

-- Backups table: allow admin delete
DROP POLICY IF EXISTS "delete_own_backups" ON backups;
CREATE POLICY "delete_own_backups" ON backups FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_current_user_admin());

-- Storage: allow admin to read any backup file
DROP POLICY IF EXISTS "Users can read own backups" ON storage.objects;
CREATE POLICY "Users can read own backups" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'backups' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_current_user_admin()));

-- Storage: allow admin to upload to any user's backup folder
DROP POLICY IF EXISTS "Users can upload own backups" ON storage.objects;
CREATE POLICY "Users can upload own backups" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'backups' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_current_user_admin()));

-- Storage: allow admin to delete any backup file
DROP POLICY IF EXISTS "Users can delete own backups" ON storage.objects;
CREATE POLICY "Users can delete own backups" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'backups' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_current_user_admin()));
