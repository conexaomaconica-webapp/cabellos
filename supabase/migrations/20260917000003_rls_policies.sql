-- Migration 3: RLS Policies for Cabellos SaaS Multi-tenant

-- 1. HELPER FUNCTIONS SECURITY DEFINER (Previne recursão RLS e previne escalada de privilégios)
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL OR p_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.organization_users
        WHERE organization_id = p_org_id
          AND user_id = auth.uid()
          AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.user_has_org_role(p_org_id UUID, p_allowed_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL OR p_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.organization_users
        WHERE organization_id = p_org_id
          AND user_id = auth.uid()
          AND role = ANY(p_allowed_roles)
          AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.user_belongs_to_org FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_org TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_has_org_role FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_org_role TO authenticated;


-- 2. HABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;


-- 3. POLÍTICAS RLS POR TABELA

-- ORGANIZATIONS
DROP POLICY IF EXISTS "Membros podem ver sua organização" ON public.organizations;
CREATE POLICY "Membros podem ver sua organização" ON public.organizations
    FOR SELECT USING (public.user_belongs_to_org(id));

DROP POLICY IF EXISTS "Somente Owner e Admin podem atualizar organização" ON public.organizations;
CREATE POLICY "Somente Owner e Admin podem atualizar organização" ON public.organizations
    FOR UPDATE USING (public.user_has_org_role(id, ARRAY['owner', 'admin']));

-- PROFILES (Identidade Global)
DROP POLICY IF EXISTS "Usuário pode ver próprio perfil" ON public.profiles;
CREATE POLICY "Usuário pode ver próprio perfil" ON public.profiles
    FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Usuário pode atualizar próprio perfil" ON public.profiles;
CREATE POLICY "Usuário pode atualizar próprio perfil" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Usuário pode inserir próprio perfil" ON public.profiles;
CREATE POLICY "Usuário pode inserir próprio perfil" ON public.profiles
    FOR INSERT WITH CHECK (id = auth.uid());

-- ORGANIZATION_USERS
DROP POLICY IF EXISTS "Membros podem ver outros membros da mesma organização" ON public.organization_users;
CREATE POLICY "Membros podem ver outros membros da mesma organização" ON public.organization_users
    FOR SELECT USING (
        user_id = auth.uid() OR public.user_belongs_to_org(organization_id)
    );

DROP POLICY IF EXISTS "Somente Owner e Admin podem adicionar membros" ON public.organization_users;
CREATE POLICY "Somente Owner e Admin podem adicionar membros" ON public.organization_users
    FOR INSERT WITH CHECK (
        public.user_has_org_role(organization_id, ARRAY['owner', 'admin'])
    );

DROP POLICY IF EXISTS "Somente Owner e Admin podem atualizar membros" ON public.organization_users;
CREATE POLICY "Somente Owner e Admin podem atualizar membros" ON public.organization_users
    FOR UPDATE USING (
        public.user_has_org_role(organization_id, ARRAY['owner', 'admin'])
    );

-- CLIENTS (SEM DELETE físico no MVP)
DROP POLICY IF EXISTS "Isolamento por Tenant em Clientes (Select)" ON public.clients;
CREATE POLICY "Isolamento por Tenant em Clientes (Select)" ON public.clients
    FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "Isolamento por Tenant em Clientes (Insert)" ON public.clients;
CREATE POLICY "Isolamento por Tenant em Clientes (Insert)" ON public.clients
    FOR INSERT WITH CHECK (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "Isolamento por Tenant em Clientes (Update)" ON public.clients;
CREATE POLICY "Isolamento por Tenant em Clientes (Update)" ON public.clients
    FOR UPDATE USING (public.user_belongs_to_org(organization_id));

-- PROFESSIONALS
DROP POLICY IF EXISTS "Isolamento por Tenant em Profissionais (Select)" ON public.professionals;
CREATE POLICY "Isolamento por Tenant em Profissionais (Select)" ON public.professionals
    FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "Somente Admin/Owner podem inserir profissionais" ON public.professionals;
CREATE POLICY "Somente Admin/Owner podem inserir profissionais" ON public.professionals
    FOR INSERT WITH CHECK (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Somente Admin/Owner podem atualizar profissionais" ON public.professionals;
CREATE POLICY "Somente Admin/Owner podem atualizar profissionais" ON public.professionals
    FOR UPDATE USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));

-- SERVICE_CATEGORIES
DROP POLICY IF EXISTS "Isolamento por Tenant em Categorias (Select)" ON public.service_categories;
CREATE POLICY "Isolamento por Tenant em Categorias (Select)" ON public.service_categories
    FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "Somente Admin/Owner podem inserir categorias" ON public.service_categories;
CREATE POLICY "Somente Admin/Owner podem inserir categorias" ON public.service_categories
    FOR INSERT WITH CHECK (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Somente Admin/Owner podem atualizar categorias" ON public.service_categories;
CREATE POLICY "Somente Admin/Owner podem atualizar categorias" ON public.service_categories
    FOR UPDATE USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));

-- SERVICES
DROP POLICY IF EXISTS "Isolamento por Tenant em Serviços (Select)" ON public.services;
CREATE POLICY "Isolamento por Tenant em Serviços (Select)" ON public.services
    FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "Somente Admin/Owner podem inserir serviços" ON public.services;
CREATE POLICY "Somente Admin/Owner podem inserir serviços" ON public.services
    FOR INSERT WITH CHECK (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "Somente Admin/Owner podem atualizar serviços" ON public.services;
CREATE POLICY "Somente Admin/Owner podem atualizar serviços" ON public.services
    FOR UPDATE USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));

-- PROFESSIONAL_SERVICES
DROP POLICY IF EXISTS "Isolamento por Tenant em Serviços do Profissional (Select)" ON public.professional_services;
CREATE POLICY "Isolamento por Tenant em Serviços do Profissional (Select)" ON public.professional_services
    FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "Somente Admin/Owner podem gerenciar Serviços do Profissional" ON public.professional_services;
CREATE POLICY "Somente Admin/Owner podem gerenciar Serviços do Profissional" ON public.professional_services
    FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));
