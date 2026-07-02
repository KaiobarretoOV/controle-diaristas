
CREATE OR REPLACE FUNCTION public.can_signup()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT COUNT(*) FROM public.user_roles) < 5
$$;

GRANT EXECUTE ON FUNCTION public.can_signup() TO anon, authenticated;
