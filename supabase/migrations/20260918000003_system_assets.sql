-- Migration 20260918000003: System Identity Assets, Storage Bucket, and Category Concurrency Protection
-- Managed exclusively by Master users (profiles.system_role = 'master')

BEGIN;

-- 1. Tabela public.system_assets
CREATE TABLE IF NOT EXISTS public.system_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type VARCHAR(50) NOT NULL,
    storage_path TEXT NOT NULL,
    file_name TEXT,
    mime_type VARCHAR(100),
    file_size BIGINT DEFAULT 0,
    width INT,
    height INT,
    duration_ms INT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_by UUID REFERENCES public.profiles(id),
    activated_at TIMESTAMPTZ,
    archived_by UUID REFERENCES public.profiles(id),
    archived_at TIMESTAMPTZ,
    CONSTRAINT chk_system_asset_type CHECK (asset_type IN (
        'logo_primary',
        'logo_compact',
        'favicon',
        'splash_video',
        'splash_image'
    ))
);

-- 2. Função Helper de Categoria Lógica para Garantia de Unicidade
CREATE OR REPLACE FUNCTION public.system_asset_category_group(p_asset_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_asset_type IN ('splash_video', 'splash_image') THEN 'splash'
    ELSE p_asset_type
  END;
$$;

-- 3. Índice Único Parcial para Concorrência Concreta no PostgreSQL (is_active = true AND archived_at IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_system_asset_category
ON public.system_assets (public.system_asset_category_group(asset_type))
WHERE is_active = true AND archived_at IS NULL;

-- 4. RPC: Transacional para Ativação com Troca Atomica e Lock de Concorrência
CREATE OR REPLACE FUNCTION public.master_activate_system_asset(p_asset_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id UUID;
    v_target_asset RECORD;
    v_target_category TEXT;
BEGIN
    v_calling_user_id := auth.uid();
    IF NOT public.user_is_master(v_calling_user_id) THEN
        RAISE EXCEPTION 'Acesso negado: Somente Master pode ativar ativos do sistema.';
    END IF;

    -- Lock FOR UPDATE no ativo solicitado
    SELECT * INTO v_target_asset
    FROM public.system_assets
    WHERE id = p_asset_id
    FOR UPDATE;

    IF v_target_asset.id IS NULL THEN
        RAISE EXCEPTION 'Ativo do sistema não encontrado.';
    END IF;

    IF v_target_asset.archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'Não é possível ativar um ativo arquivado.';
    END IF;

    v_target_category := public.system_asset_category_group(v_target_asset.asset_type);

    -- Desativar ativo anterior da mesma categoria lógica
    UPDATE public.system_assets
    SET is_active = false,
        updated_at = NOW()
    WHERE public.system_asset_category_group(asset_type) = v_target_category
      AND is_active = true
      AND id <> p_asset_id;

    -- Ativar o novo ativo
    UPDATE public.system_assets
    SET is_active = true,
        activated_by = v_calling_user_id,
        activated_at = NOW()
    WHERE id = p_asset_id;

    -- Registrar Auditoria Master
    INSERT INTO public.master_audit_logs (
        master_user_id, action, entity_type, entity_id, after_data
    ) VALUES (
        v_calling_user_id,
        CASE WHEN v_target_category = 'splash' THEN 'splash_activated' ELSE 'system_logo_activated' END,
        'system_asset',
        p_asset_id,
        jsonb_build_object(
            'asset_type', v_target_asset.asset_type,
            'category_group', v_target_category,
            'storage_path', v_target_asset.storage_path
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'asset_id', p_asset_id,
        'asset_type', v_target_asset.asset_type,
        'category_group', v_target_category
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.master_activate_system_asset FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.master_activate_system_asset TO authenticated;

-- 5. RPC: Desativar Splash Screen
CREATE OR REPLACE FUNCTION public.master_deactivate_splash()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id UUID;
BEGIN
    v_calling_user_id := auth.uid();
    IF NOT public.user_is_master(v_calling_user_id) THEN
        RAISE EXCEPTION 'Acesso negado: Somente Master pode alterar a Splash Screen.';
    END IF;

    UPDATE public.system_assets
    SET is_active = false
    WHERE public.system_asset_category_group(asset_type) = 'splash'
      AND is_active = true;

    INSERT INTO public.master_audit_logs (
        master_user_id, action, entity_type
    ) VALUES (
        v_calling_user_id, 'splash_deactivated', 'system_asset'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.master_deactivate_splash FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.master_deactivate_splash TO authenticated;

-- 6. RPC Pública: get_system_branding() para consumo no frontend
CREATE OR REPLACE FUNCTION public.get_system_branding()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_logo_primary RECORD;
    v_logo_compact RECORD;
    v_favicon RECORD;
    v_splash RECORD;
    v_settings RECORD;
    v_supabase_url TEXT;
BEGIN
    SELECT value->>'url' INTO v_supabase_url FROM public.platform_settings WHERE key = 'supabase_url';
    
    -- Logo Primary
    SELECT * INTO v_logo_primary
    FROM public.system_assets
    WHERE asset_type = 'logo_primary' AND is_active = true AND archived_at IS NULL
    LIMIT 1;

    -- Logo Compact
    SELECT * INTO v_logo_compact
    FROM public.system_assets
    WHERE asset_type = 'logo_compact' AND is_active = true AND archived_at IS NULL
    LIMIT 1;

    -- Favicon
    SELECT * INTO v_favicon
    FROM public.system_assets
    WHERE asset_type = 'favicon' AND is_active = true AND archived_at IS NULL
    LIMIT 1;

    -- Splash
    SELECT * INTO v_splash
    FROM public.system_assets
    WHERE asset_type IN ('splash_video', 'splash_image') AND is_active = true AND archived_at IS NULL
    LIMIT 1;

    RETURN jsonb_build_object(
        'logo_primary', CASE WHEN v_logo_primary.id IS NOT NULL THEN jsonb_build_object(
            'id', v_logo_primary.id,
            'storage_path', v_logo_primary.storage_path,
            'mime_type', v_logo_primary.mime_type
        ) ELSE NULL END,
        'logo_compact', CASE WHEN v_logo_compact.id IS NOT NULL THEN jsonb_build_object(
            'id', v_logo_compact.id,
            'storage_path', v_logo_compact.storage_path,
            'mime_type', v_logo_compact.mime_type
        ) ELSE NULL END,
        'favicon', CASE WHEN v_favicon.id IS NOT NULL THEN jsonb_build_object(
            'id', v_favicon.id,
            'storage_path', v_favicon.storage_path
        ) ELSE NULL END,
        'splash', CASE WHEN v_splash.id IS NOT NULL THEN jsonb_build_object(
            'id', v_splash.id,
            'asset_type', v_splash.asset_type,
            'storage_path', v_splash.storage_path,
            'mime_type', v_splash.mime_type
        ) ELSE NULL END
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_system_branding FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_system_branding TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_branding TO anon;

-- 7. Políticas RLS
ALTER TABLE public.system_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RLS Select system_assets" ON public.system_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "RLS Manage system_assets" ON public.system_assets FOR ALL TO authenticated USING (public.user_is_master(auth.uid()));

COMMIT;
