
CREATE TABLE public.demandas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data_inicio date,
  data_fim date,
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandas TO anon, authenticated;
GRANT ALL ON public.demandas TO service_role;
ALTER TABLE public.demandas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read demandas" ON public.demandas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert demandas" ON public.demandas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public update demandas" ON public.demandas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public delete demandas" ON public.demandas FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER trg_demandas_updated BEFORE UPDATE ON public.demandas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.escalas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diarista_id uuid NOT NULL REFERENCES public.diaristas(id) ON DELETE CASCADE,
  demanda_id uuid REFERENCES public.demandas(id) ON DELETE SET NULL,
  data date NOT NULL,
  valor_diaria numeric(10,2) NOT NULL DEFAULT 100,
  valor_passagem numeric(10,2) NOT NULL DEFAULT 20,
  eh_feriado boolean NOT NULL DEFAULT false,
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diarista_id, data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escalas TO anon, authenticated;
GRANT ALL ON public.escalas TO service_role;
ALTER TABLE public.escalas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read escalas" ON public.escalas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert escalas" ON public.escalas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public update escalas" ON public.escalas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public delete escalas" ON public.escalas FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX idx_escalas_data ON public.escalas(data);
CREATE INDEX idx_escalas_diarista ON public.escalas(diarista_id);
CREATE INDEX idx_escalas_demanda ON public.escalas(demanda_id);
CREATE TRIGGER trg_escalas_updated BEFORE UPDATE ON public.escalas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.advertencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diarista_id uuid NOT NULL REFERENCES public.diaristas(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  motivo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advertencias TO anon, authenticated;
GRANT ALL ON public.advertencias TO service_role;
ALTER TABLE public.advertencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read advertencias" ON public.advertencias FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert advertencias" ON public.advertencias FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public update advertencias" ON public.advertencias FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public delete advertencias" ON public.advertencias FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX idx_advertencias_diarista ON public.advertencias(diarista_id);

CREATE TABLE public.epi_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('bota','colete')),
  tamanho text NOT NULL,
  quantidade_total integer NOT NULL DEFAULT 0 CHECK (quantidade_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, tamanho)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.epi_estoque TO anon, authenticated;
GRANT ALL ON public.epi_estoque TO service_role;
ALTER TABLE public.epi_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read epi_estoque" ON public.epi_estoque FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert epi_estoque" ON public.epi_estoque FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public update epi_estoque" ON public.epi_estoque FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public delete epi_estoque" ON public.epi_estoque FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER trg_epi_estoque_updated BEFORE UPDATE ON public.epi_estoque FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.epi_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('bota','colete')),
  tamanho text NOT NULL,
  diarista_id uuid NOT NULL REFERENCES public.diaristas(id) ON DELETE CASCADE,
  entregue_em timestamptz NOT NULL DEFAULT now(),
  devolvido_em timestamptz,
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.epi_entregas TO anon, authenticated;
GRANT ALL ON public.epi_entregas TO service_role;
ALTER TABLE public.epi_entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read epi_entregas" ON public.epi_entregas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert epi_entregas" ON public.epi_entregas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public update epi_entregas" ON public.epi_entregas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public delete epi_entregas" ON public.epi_entregas FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX idx_epi_entregas_ativas ON public.epi_entregas(tipo, tamanho) WHERE devolvido_em IS NULL;
CREATE INDEX idx_epi_entregas_diarista ON public.epi_entregas(diarista_id);
