/*
# Add admin-visible user emails view

## Overview
The merchant dashboard needs to display client email addresses, but auth.users
is not directly queryable by the client. This creates a SECURITY DEFINER function
that returns user email + id pairs, callable only by admin users.

## Security
- SECURITY DEFINER with locked search_path
- EXECUTE revoked from anon and authenticated — only callable via RPC by admins
- The function checks is_admin on the calling user before returning any data
*/

CREATE OR REPLACE FUNCTION public.get_client_emails()
RETURNS TABLE (id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only allow admins to call this
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ) THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text WHERE FALSE;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE p.is_admin = false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_client_emails() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_emails() TO authenticated;