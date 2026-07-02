CREATE TABLE public.diaristas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL DEFAULT '',
  endereco TEXT NOT NULL DEFAULT '',
  localidade TEXT NOT NULL DEFAULT '',
  lider TEXT NOT NULL DEFAULT '',
  turno TEXT NOT NULL DEFAULT 'Manhã',
  telefone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Ativo',
  foto TEXT,
  uniforme JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diaristas TO authenticated;
GRANT ALL ON public.diaristas TO service_role;

ALTER TABLE public.diaristas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own diaristas"
  ON public.diaristas FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX diaristas_user_id_idx ON public.diaristas(user_id);
CREATE INDEX diaristas_status_idx ON public.diaristas(user_id, status);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_diaristas_updated_at
  BEFORE UPDATE ON public.diaristas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();