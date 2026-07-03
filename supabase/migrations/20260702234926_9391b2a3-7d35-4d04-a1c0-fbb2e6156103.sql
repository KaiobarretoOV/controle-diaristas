
-- Função is_active_user: admin ou leader
CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','leader')
  )
$$;

REVOKE ALL ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated;

-- Tabela access_requests
CREATE TABLE IF NOT EXISTS public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  note text NOT NULL DEFAULT '',
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages access requests"
  ON public.access_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "User can view own request"
  ON public.access_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Atualizar políticas: dados compartilhados entre admin + leader
-- diaristas
DROP POLICY IF EXISTS "Admins full access on diaristas" ON public.diaristas;
CREATE POLICY "Active users manage diaristas"
  ON public.diaristas FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

-- demandas
DROP POLICY IF EXISTS "Admins full access on demandas" ON public.demandas;
CREATE POLICY "Active users manage demandas"
  ON public.demandas FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

-- escalas
DROP POLICY IF EXISTS "Admins full access on escalas" ON public.escalas;
CREATE POLICY "Active users manage escalas"
  ON public.escalas FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

-- advertencias
DROP POLICY IF EXISTS "Admins full access on advertencias" ON public.advertencias;
CREATE POLICY "Active users manage advertencias"
  ON public.advertencias FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

-- epi_estoque
DROP POLICY IF EXISTS "Admins full access on epi_estoque" ON public.epi_estoque;
CREATE POLICY "Active users manage epi_estoque"
  ON public.epi_estoque FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

-- epi_entregas
DROP POLICY IF EXISTS "Admins full access on epi_entregas" ON public.epi_entregas;
CREATE POLICY "Active users manage epi_entregas"
  ON public.epi_entregas FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

-- Reescrever handle_new_user_role
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'kaiovictor704@gmail.com'
     OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
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

-- Garantir trigger em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- can_signup: sem limite
CREATE OR REPLACE FUNCTION public.can_signup()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT true $$;

-- Se o admin kaiovictor704@gmail.com já existe mas está como 'user', promover
UPDATE public.user_roles ur
SET role = 'admin'
FROM auth.users u
WHERE ur.user_id = u.id
  AND u.email = 'kaiovictor704@gmail.com'
  AND ur.role <> 'admin';

-- Limpar solicitação pendente para o admin, se houver
DELETE FROM public.access_requests ar
USING auth.users u
WHERE ar.user_id = u.id AND u.email = 'kaiovictor704@gmail.com';

-- Função admin_users_overview
CREATE OR REPLACE FUNCTION public.admin_users_overview()
RETURNS TABLE (
  user_id uuid,
  email text,
  role app_role,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  request_status text,
  requested_at timestamptz,
  reviewed_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    ur.role,
    u.created_at,
    u.last_sign_in_at,
    ar.status,
    ar.requested_at,
    ar.reviewed_at
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.access_requests ar ON ar.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_users_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_users_overview() TO authenticated;

-- Aprovar solicitação
CREATE OR REPLACE FUNCTION public.approve_access_request(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.user_roles SET role = 'leader' WHERE user_id = _user_id;
  IF NOT FOUND THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'leader');
  END IF;
  UPDATE public.access_requests
    SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
    WHERE user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_access_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_access_request(uuid) TO authenticated;

-- Rejeitar / revogar
CREATE OR REPLACE FUNCTION public.revoke_access(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF public.has_role(_user_id,'admin') THEN
    RAISE EXCEPTION 'cannot revoke admin';
  END IF;
  UPDATE public.user_roles SET role = 'user' WHERE user_id = _user_id;
  UPDATE public.access_requests
    SET status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
    WHERE user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_access(uuid) TO authenticated;

-- Status do próprio usuário (para tela de espera)
CREATE OR REPLACE FUNCTION public.my_access_status()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(),'admin') THEN 'admin'
    WHEN public.has_role(auth.uid(),'leader') THEN 'leader'
    ELSE 'pending'
  END
$$;
REVOKE ALL ON FUNCTION public.my_access_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_access_status() TO authenticated;
