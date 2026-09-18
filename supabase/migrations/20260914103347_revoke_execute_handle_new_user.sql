/*
# Revoke all EXECUTE on handle_new_user

The handle_new_user function is a trigger function (SECURITY DEFINER)
that should only be called by the auth.users INSERT trigger — never via REST/RPC.
Revoke from all roles including PUBLIC.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;