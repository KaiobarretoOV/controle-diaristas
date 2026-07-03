
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['advertencias','demandas','escalas','epi_estoque','epi_entregas']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "public read %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "public insert %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "public update %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "public delete %I" ON public.%I', t, t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('CREATE POLICY "Admins manage all %I" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))', t, t);
  END LOOP;
END $$;
