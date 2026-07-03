
-- Restore EXECUTE for functions used by RLS policies and RPC calls.
-- These were revoked by a previous security hardening pass, which broke
-- RLS evaluation (has_role/is_active_user) and RPC access.

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_active_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.my_access_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_access_status() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_users_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_users_overview() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.approve_access_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_access_request(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.revoke_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_access(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_signup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_signup() TO anon, authenticated, service_role;
