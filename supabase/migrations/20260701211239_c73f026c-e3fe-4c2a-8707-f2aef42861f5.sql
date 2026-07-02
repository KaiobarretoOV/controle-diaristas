
ALTER TABLE public.diaristas ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "Admins can view diaristas" ON public.diaristas;
DROP POLICY IF EXISTS "Admins can insert diaristas" ON public.diaristas;
DROP POLICY IF EXISTS "Admins can update diaristas" ON public.diaristas;
DROP POLICY IF EXISTS "Admins can delete diaristas" ON public.diaristas;
DROP POLICY IF EXISTS "Users can view their own diaristas" ON public.diaristas;
DROP POLICY IF EXISTS "Users can insert their own diaristas" ON public.diaristas;
DROP POLICY IF EXISTS "Users can update their own diaristas" ON public.diaristas;
DROP POLICY IF EXISTS "Users can delete their own diaristas" ON public.diaristas;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diaristas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diaristas TO authenticated;

CREATE POLICY "Public can view diaristas" ON public.diaristas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can insert diaristas" ON public.diaristas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can update diaristas" ON public.diaristas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete diaristas" ON public.diaristas FOR DELETE TO anon, authenticated USING (true);
