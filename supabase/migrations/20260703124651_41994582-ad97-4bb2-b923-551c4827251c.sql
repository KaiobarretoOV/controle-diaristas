
-- 1) Remove hardcoded admin email backdoor from the new-user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
    INSERT INTO public.access_requests (user_id, email, status)
    VALUES (NEW.id, NEW.email, 'pending')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Revoke EXECUTE from anon on all SECURITY DEFINER functions (prevents unauthenticated probing).
-- Keep EXECUTE for authenticated where RLS policies / RPC calls require it.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.my_access_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_access_status() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_users_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_users_overview() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.approve_access_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_access_request(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.revoke_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_access(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_signup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_signup() TO service_role;

-- Trigger-only functions: only the table owner needs to invoke them.
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_role() TO service_role;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
