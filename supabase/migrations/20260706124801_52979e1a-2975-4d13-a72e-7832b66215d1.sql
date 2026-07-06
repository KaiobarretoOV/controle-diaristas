
-- 1) Escolher "keeper" por CPF (não vazio) e mapear duplicados -> keeper
WITH ranked AS (
  SELECT
    id,
    cpf,
    row_number() OVER (
      PARTITION BY cpf
      ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST,
               created_at DESC NULLS LAST,
               id DESC
    ) AS rn,
    first_value(id) OVER (
      PARTITION BY cpf
      ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST,
               created_at DESC NULLS LAST,
               id DESC
    ) AS keeper_id
  FROM public.diaristas
  WHERE cpf IS NOT NULL AND btrim(cpf) <> ''
),
dupes AS (
  SELECT id AS dup_id, keeper_id
  FROM ranked
  WHERE rn > 1 AND id <> keeper_id
)
-- 2) Reatribuir dependências para o keeper (usar DO block)
, upd_escalas AS (
  UPDATE public.escalas e
     SET diarista_id = d.keeper_id
    FROM dupes d
   WHERE e.diarista_id = d.dup_id
  RETURNING 1
), upd_adv AS (
  UPDATE public.advertencias a
     SET diarista_id = d.keeper_id
    FROM dupes d
   WHERE a.diarista_id = d.dup_id
  RETURNING 1
), upd_epi AS (
  UPDATE public.epi_entregas ep
     SET diarista_id = d.keeper_id
    FROM dupes d
   WHERE ep.diarista_id = d.dup_id
  RETURNING 1
), upd_links AS (
  UPDATE public.signup_links s
     SET used_diarista_id = d.keeper_id
    FROM dupes d
   WHERE s.used_diarista_id = d.dup_id
  RETURNING 1
)
-- 3) Apagar duplicados
DELETE FROM public.diaristas
 WHERE id IN (SELECT dup_id FROM dupes);

-- 4) Índice único parcial (impede novos duplicados por CPF)
CREATE UNIQUE INDEX IF NOT EXISTS diaristas_cpf_unique
  ON public.diaristas (cpf)
  WHERE cpf IS NOT NULL AND btrim(cpf) <> '';
