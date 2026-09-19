-- Migration 20260918000005: Add updated_at to system_assets

BEGIN;

ALTER TABLE public.system_assets 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Trigger opcional para atualizar automaticamente updated_at (caso desejado no futuro)
-- Mas como a RPC já faz 'updated_at = NOW()', a simples existência da coluna já resolve o erro.

COMMIT;
