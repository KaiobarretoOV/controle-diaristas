
-- 1. Adicionar valor 'leader' ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'leader';
