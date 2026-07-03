ALTER TABLE public.diaristas ADD COLUMN IF NOT EXISTS sexo text;
ALTER TABLE public.diaristas ADD CONSTRAINT diaristas_sexo_check CHECK (sexo IS NULL OR sexo IN ('M','F'));