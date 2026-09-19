-- Migration 2: Triggers and RPC Functions for Cabellos

-- 1. TRIGGER REUTILIZÁVEL PARA UPDATED_AT
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_organizations ON public.organizations;
CREATE TRIGGER trg_set_updated_at_organizations BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_profiles ON public.profiles;
CREATE TRIGGER trg_set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_org_users ON public.organization_users;
CREATE TRIGGER trg_set_updated_at_org_users BEFORE UPDATE ON public.organization_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_clients ON public.clients;
CREATE TRIGGER trg_set_updated_at_clients BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_professionals ON public.professionals;
CREATE TRIGGER trg_set_updated_at_professionals BEFORE UPDATE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_service_categories ON public.service_categories;
CREATE TRIGGER trg_set_updated_at_service_categories BEFORE UPDATE ON public.service_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_services ON public.services;
CREATE TRIGGER trg_set_updated_at_services BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_prof_services ON public.professional_services;
CREATE TRIGGER trg_set_updated_at_prof_services BEFORE UPDATE ON public.professional_services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2. VALIDAÇÃO DE REFERÊNCIAS CROSS-TENANT (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.validate_cross_tenant_references()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar clients: preferred_professional_id e preferred_service_id
    IF TG_TABLE_NAME = 'clients' THEN
        IF NEW.preferred_professional_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.professionals p
                WHERE p.id = NEW.preferred_professional_id AND p.organization_id = NEW.organization_id
            ) THEN
                RAISE EXCEPTION 'Cross-tenant error: O profissional preferido pertence a outra organização.';
            END IF;
        END IF;

        IF NEW.preferred_service_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.services s
                WHERE s.id = NEW.preferred_service_id AND s.organization_id = NEW.organization_id
            ) THEN
                RAISE EXCEPTION 'Cross-tenant error: O serviço preferido pertence a outra organização.';
            END IF;
        END IF;
    END IF;

    -- Validar services: category_id
    IF TG_TABLE_NAME = 'services' THEN
        IF NEW.category_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.service_categories c
                WHERE c.id = NEW.category_id AND c.organization_id = NEW.organization_id
            ) THEN
                RAISE EXCEPTION 'Cross-tenant error: A categoria pertence a outra organização.';
            END IF;
        END IF;
    END IF;

    -- Validar professional_services: professional_id e service_id
    IF TG_TABLE_NAME = 'professional_services' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.professionals p
            WHERE p.id = NEW.professional_id AND p.organization_id = NEW.organization_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant error: O profissional pertence a outra organização.';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.services s
            WHERE s.id = NEW.service_id AND s.organization_id = NEW.organization_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant error: O serviço pertence a outra organização.';
        END IF;
    END IF;

    -- Validar professionals: user_id (se vinculado a um auth user)
    IF TG_TABLE_NAME = 'professionals' THEN
        IF NEW.user_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.organization_users ou
                WHERE ou.user_id = NEW.user_id AND ou.organization_id = NEW.organization_id AND ou.is_active = TRUE
            ) THEN
                RAISE EXCEPTION 'Cross-tenant error: O usuário informado não é membro desta organização.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_cross_tenant_clients ON public.clients;
CREATE TRIGGER trg_validate_cross_tenant_clients BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_references();

DROP TRIGGER IF EXISTS trg_validate_cross_tenant_services ON public.services;
CREATE TRIGGER trg_validate_cross_tenant_services BEFORE INSERT OR UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_references();

DROP TRIGGER IF EXISTS trg_validate_cross_tenant_prof_services ON public.professional_services;
CREATE TRIGGER trg_validate_cross_tenant_prof_services BEFORE INSERT OR UPDATE ON public.professional_services FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_references();

DROP TRIGGER IF EXISTS trg_validate_cross_tenant_professionals ON public.professionals;
CREATE TRIGGER trg_validate_cross_tenant_professionals BEFORE INSERT OR UPDATE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_references();


-- 3. RPC TRANSACIONAL DE ONBOARDING ATÔMICO
DROP FUNCTION IF EXISTS public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
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
