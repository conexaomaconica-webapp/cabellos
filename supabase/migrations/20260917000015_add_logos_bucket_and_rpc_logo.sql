-- Migration 15: Create logos storage bucket and update create_organization_with_owner RPC

-- 1. Garante que o bucket 'logos' existe na tabela storage.buckets com acesso público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'logos',
    'logos',
    true,
    5242880, -- 5MB
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Políticas RLS para storage.objects no bucket 'logos'
DROP POLICY IF EXISTS "Public Read Logos" ON storage.objects;
CREATE POLICY "Public Read Logos" ON storage.objects
    FOR SELECT USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Authenticated Upload Logos" ON storage.objects;
CREATE POLICY "Authenticated Upload Logos" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'logos');

DROP POLICY IF EXISTS "Authenticated Update Logos" ON storage.objects;
CREATE POLICY "Authenticated Update Logos" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Authenticated Delete Logos" ON storage.objects;
CREATE POLICY "Authenticated Delete Logos" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'logos');

-- 3. Atualiza a RPC create_organization_with_owner para aceitar p_logo_url
DROP FUNCTION IF EXISTS public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
    p_name TEXT,
    p_phone TEXT DEFAULT NULL,
    p_whatsapp TEXT DEFAULT NULL,
    p_primary_color TEXT DEFAULT '#0f172a',
    p_secondary_color TEXT DEFAULT '#64748b',
    p_logo_url TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_result JSONB;
BEGIN
    -- Obter usuário autenticado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    -- 1. Criar Organização
    INSERT INTO public.organizations (
        name, phone, whatsapp, primary_color, secondary_color, logo_url
    ) VALUES (
        p_name, p_phone, p_whatsapp, COALESCE(p_primary_color, '#0f172a'), COALESCE(p_secondary_color, '#64748b'), p_logo_url
    ) RETURNING id INTO v_org_id;

    -- 2. Vincular usuário logado como OWNER
    INSERT INTO public.organization_users (
        organization_id, user_id, role, is_active
    ) VALUES (
        v_org_id, v_user_id, 'owner', TRUE
    );

    -- 3. Criar Categorias de Serviços Padrão
    INSERT INTO public.service_categories (organization_id, name, description, color, sort_order) VALUES
    (v_org_id, 'Cabelo', 'Cortes, penteados e tratamentos capilares', '#3b82f6', 1),
    (v_org_id, 'Barba', 'Barba, toalha quente e alinhamento', '#10b981', 2),
    (v_org_id, 'Unhas', 'Manicure e pedicure', '#ec4899', 3),
    (v_org_id, 'Estética', 'Limpeza de pele, depilação e tratamentos', '#8b5cf6', 4);

    -- 4. Retornar JSON com dados da nova organização
    SELECT jsonb_build_object(
        'id', organizations.id,
        'name', name,
        'primary_color', primary_color,
        'secondary_color', secondary_color,
        'logo_url', logo_url
    ) INTO v_result
    FROM public.organizations
    WHERE organizations.id = v_org_id;

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE; -- Rollback automático da transação
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
