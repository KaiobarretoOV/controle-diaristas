
-- Diaristas: drop public policies (admin policy remains)
DROP POLICY IF EXISTS "Public can view diaristas" ON public.diaristas;
DROP POLICY IF EXISTS "Public can insert diaristas" ON public.diaristas;
DROP POLICY IF EXISTS "Public can update diaristas" ON public.diaristas;
DROP POLICY IF EXISTS "Public can delete diaristas" ON public.diaristas;

REVOKE ALL ON public.diaristas FROM anon;

-- user_roles: add explicit admin-only write policies to prevent privilege escalation
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Lock down SECURITY DEFINER functions from public execution
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_signup() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.can_signup() TO anon, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
