-- Migration 20260919000002: Add foreign key from organization_users to profiles for PostgREST relationship

BEGIN;

ALTER TABLE public.organization_users
  DROP CONSTRAINT IF EXISTS fk_org_users_profile;

ALTER TABLE public.organization_users
  ADD CONSTRAINT fk_org_users_profile 
  FOREIGN KEY (user_id) 
  REFERENCES public.profiles(id) 
  ON DELETE CASCADE;

-- Atualizar o schema cache do PostgREST (opcionalmente feito via NOTIFY pgrst)
NOTIFY pgrst, 'reload schema';

COMMIT;
