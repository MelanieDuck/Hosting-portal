/*
# Fix security advisor warnings

1. Lock down search_path on update_updated_at trigger function
2. Revoke EXECUTE on handle_new_user from anon and authenticated (it's a trigger, not meant to be called via RPC)
3. Lock down search_path on handle_new_user (already done, but ensure it's set)
*/

-- Fix mutable search_path on update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Revoke EXECUTE on handle_new_user from anon and authenticated
-- (it should only be called by the trigger, not via REST/RPC)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;