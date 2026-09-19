-- Migration 20260919000001: Expose height in get_system_branding RPC

BEGIN;

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
            'mime_type', v_logo_primary.mime_type,
            'height', v_logo_primary.height
        ) ELSE NULL END,
        'logo_compact', CASE WHEN v_logo_compact.id IS NOT NULL THEN jsonb_build_object(
            'id', v_logo_compact.id,
            'storage_path', v_logo_compact.storage_path,
            'mime_type', v_logo_compact.mime_type,
            'height', v_logo_compact.height
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

COMMIT;
