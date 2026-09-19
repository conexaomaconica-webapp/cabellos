-- Migration 20260918000002: Master Module Schema, RPCs, Security, and Backfill
-- Platform administration for Cabellos (profiles.system_role = 'master')

BEGIN;

-- 1. Campos de status e ciclo de vida em public.organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS provisioning_status VARCHAR(20) NOT NULL DEFAULT 'ready',
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS archive_reason TEXT,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_organizations_status') THEN
        ALTER TABLE public.organizations
        ADD CONSTRAINT chk_organizations_status CHECK (status IN ('active', 'suspended', 'archived'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_organizations_provisioning_status') THEN
        ALTER TABLE public.organizations
        ADD CONSTRAINT chk_organizations_provisioning_status CHECK (provisioning_status IN ('ready', 'pending_admin', 'failed'));
    END IF;
END $$;

-- 2. Proteção contra UPDATE direto em profiles.system_role por usuários não-master
CREATE OR REPLACE FUNCTION public.prevent_direct_system_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.system_role IS DISTINCT FROM OLD.system_role THEN
        IF current_setting('cabellos.allow_system_role_change', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Alteração direta de system_role não permitida. Use a RPC master_manage_user_system_role.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_system_role_update ON public.profiles;
CREATE TRIGGER trg_prevent_direct_system_role_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_system_role_update();

-- 3. Tabela saas_plans (Planos comerciais da plataforma)
CREATE TABLE IF NOT EXISTS public.saas_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    yearly_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    trial_days INT NOT NULL DEFAULT 14,
    max_users INT NOT NULL DEFAULT 5,
    max_professionals INT NOT NULL DEFAULT 5,
    max_clients INT NOT NULL DEFAULT 1000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabela saas_plan_features (Catálogo de recursos por plano)
CREATE TABLE IF NOT EXISTS public.saas_plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.saas_plans(id) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    limit_value INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_saas_plan_feature_key CHECK (feature_key IN (
        'financial_module',
        'reports_module',
        'packages_module',
        'returns_module',
        'csv_export',
        'advanced_reports'
    )),
    UNIQUE(plan_id, feature_key)
);

-- 5. Tabela organization_subscriptions (Assinaturas ativas)
CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    saas_plan_id UUID NOT NULL REFERENCES public.saas_plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
    price_snapshot NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_org_sub_status CHECK (status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired')),
    CONSTRAINT chk_org_sub_billing_cycle CHECK (billing_cycle IN ('monthly', 'yearly', 'manual'))
);

-- Constraint de assinatura corrente única por organização
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_current_subscription
ON public.organization_subscriptions (organization_id)
WHERE status IN ('trial', 'active', 'past_due', 'suspended');

-- 6. Tabela subscription_events (Histórico imutável de assinaturas)
CREATE TABLE IF NOT EXISTS public.subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_subscription_id UUID NOT NULL REFERENCES public.organization_subscriptions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    old_plan_id UUID REFERENCES public.saas_plans(id),
    new_plan_id UUID REFERENCES public.saas_plans(id),
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Tabela tenant_backups (Metadados de exportações por tenant)
CREATE TABLE IF NOT EXISTS public.tenant_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.profiles(id),
    type VARCHAR(20) NOT NULL DEFAULT 'manual_export',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    storage_path TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    checksum_algorithm VARCHAR(20) NOT NULL DEFAULT 'SHA-256',
    checksum VARCHAR(128),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_backup_type CHECK (type IN ('manual_export', 'scheduled_export')),
    CONSTRAINT chk_backup_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired'))
);

-- 8. Tabela master_audit_logs (Trilha de auditoria imutável INSERT-only)
CREATE TABLE IF NOT EXISTS public.master_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_user_id UUID NOT NULL REFERENCES public.profiles(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    organization_id UUID REFERENCES public.organizations(id),
    before_data JSONB,
    after_data JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Tabela platform_settings (Configurações globais)
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id)
);

-- Inserir configurações padrão
INSERT INTO public.platform_settings (key, value, description)
VALUES
  ('default_trial_days', '14'::jsonb, 'Dias padrão de teste para novos salões'),
  ('backup_retention_days', '30'::jsonb, 'Dias de retenção das exportações de segurança'),
  ('maintenance_mode', 'false'::jsonb, 'Modo de manutenção global da aplicação'),
  ('allow_new_signups', 'true'::jsonb, 'Permite cadastros/onboarding públicos espontâneos')
ON CONFLICT (key) DO NOTHING;

-- 10. Helper de Verificação de Atividade do Tenant
CREATE OR REPLACE FUNCTION public.organization_is_active(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = p_org_id AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.organization_is_active TO authenticated;

-- 11. RPC: master_manage_user_system_role (Com LOCK FOR UPDATE prevenindo 0 masters)
CREATE OR REPLACE FUNCTION public.master_manage_user_system_role(
    p_target_user_id UUID,
    p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id UUID;
    v_master_count INT;
    v_old_role TEXT;
BEGIN
    v_calling_user_id := auth.uid();
    
    IF NOT public.user_is_master(v_calling_user_id) THEN
        RAISE EXCEPTION 'Acesso negado: Somente Master pode alterar o papel do sistema.';
    END IF;

    IF p_new_role NOT IN ('master', 'user') THEN
        RAISE EXCEPTION 'Papel inválido. Deve ser master ou user.';
    END IF;

    -- Lock de concorrência na tabela profiles para evitar race condition
    PERFORM id FROM public.profiles WHERE system_role = 'master' FOR UPDATE;

    SELECT system_role INTO v_old_role FROM public.profiles WHERE id = p_target_user_id;

    IF v_old_role IS NULL THEN
        RAISE EXCEPTION 'Usuário não encontrado.';
    END IF;

    IF v_old_role = p_new_role THEN
        RETURN jsonb_build_object('success', true, 'message', 'Papel já atribuído.');
    END IF;

    -- Trava do último master
    IF v_old_role = 'master' AND p_new_role = 'user' THEN
        SELECT COUNT(*) INTO v_master_count FROM public.profiles WHERE system_role = 'master';
        IF v_master_count <= 1 THEN
            RAISE EXCEPTION 'Operação rejeitada: Impossível rebaixar o último Master ativo da plataforma.';
        END IF;
    END IF;

    -- Habilitar flag temporária na sessão para permitir a alteração
    PERFORM set_config('cabellos.allow_system_role_change', 'true', true);

    UPDATE public.profiles
    SET system_role = p_new_role,
        updated_at = NOW()
    WHERE id = p_target_user_id;

    -- Registrar auditoria
    INSERT INTO public.master_audit_logs (
        master_user_id, action, entity_type, entity_id, before_data, after_data
    ) VALUES (
        v_calling_user_id,
        'manage_user_system_role',
        'profile',
        p_target_user_id,
        jsonb_build_object('system_role', v_old_role),
        jsonb_build_object('system_role', p_new_role)
    );

    RETURN jsonb_build_object('success', true, 'old_role', v_old_role, 'new_role', p_new_role);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.master_manage_user_system_role FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.master_manage_user_system_role TO authenticated;

-- 12. Migration Backfill: Criar plano padrão e assinar salões legados
DO $$
DECLARE
    v_default_plan_id UUID;
    v_org RECORD;
BEGIN
    -- Garantir Plano Padrão / Legado
    INSERT INTO public.saas_plans (name, slug, description, monthly_price, yearly_price, max_users, max_professionals, max_clients, is_active, is_public, sort_order)
    VALUES ('Plano Padrão (Legado)', 'plano-padrao', 'Plano atribuído automaticamente aos salões existentes', 149.00, 1490.00, 10, 10, 5000, true, true, 1)
    ON CONFLICT (slug) DO UPDATE SET is_active = true
    RETURNING id INTO v_default_plan_id;

    IF v_default_plan_id IS NULL THEN
        SELECT id INTO v_default_plan_id FROM public.saas_plans WHERE slug = 'plano-padrao';
    END IF;

    -- Inserir features padrão
    INSERT INTO public.saas_plan_features (plan_id, feature_key, enabled)
    VALUES
        (v_default_plan_id, 'financial_module', true),
        (v_default_plan_id, 'reports_module', true),
        (v_default_plan_id, 'packages_module', true),
        (v_default_plan_id, 'returns_module', true),
        (v_default_plan_id, 'csv_export', true),
        (v_default_plan_id, 'advanced_reports', true)
    ON CONFLICT (plan_id, feature_key) DO NOTHING;

    -- Criar assinatura ativa para cada organização que ainda não possuir assinatura corrente
    FOR v_org IN SELECT id FROM public.organizations LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.organization_subscriptions
            WHERE organization_id = v_org.id AND status IN ('trial', 'active', 'past_due', 'suspended')
        ) THEN
            INSERT INTO public.organization_subscriptions (
                organization_id, saas_plan_id, status, billing_cycle, price_snapshot, current_period_start, current_period_end
            ) VALUES (
                v_org.id, v_default_plan_id, 'active', 'monthly', 149.00, NOW(), NOW() + INTERVAL '1 month'
            );
        END IF;
    END LOOP;
END $$;

-- 13. RPC: get_current_subscription(p_org_id) para consulta pelo salão
CREATE OR REPLACE FUNCTION public.get_current_subscription(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sub RECORD;
    v_plan RECORD;
    v_features JSONB;
BEGIN
    -- Validar autorização do usuário no tenant
    IF NOT public.user_has_org_role(p_org_id, ARRAY['admin', 'receptionist', 'professional']) THEN
        RAISE EXCEPTION 'Acesso negado ao tenant.';
    END IF;

    SELECT s.* INTO v_sub
    FROM public.organization_subscriptions s
    WHERE s.organization_id = p_org_id AND s.status IN ('trial', 'active', 'past_due', 'suspended')
    LIMIT 1;

    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object('has_subscription', false);
    END IF;

    SELECT p.* INTO v_plan
    FROM public.saas_plans p
    WHERE p.id = v_sub.saas_plan_id;

    SELECT jsonb_object_agg(feature_key, enabled) INTO v_features
    FROM public.saas_plan_features
    WHERE plan_id = v_plan.id;

    RETURN jsonb_build_object(
        'has_subscription', true,
        'subscription_id', v_sub.id,
        'status', v_sub.status,
        'billing_cycle', v_sub.billing_cycle,
        'current_period_end', v_sub.current_period_end,
        'trial_ends_at', v_sub.trial_ends_at,
        'plan', jsonb_build_object(
            'id', v_plan.id,
            'name', v_plan.name,
            'slug', v_plan.slug,
            'max_users', v_plan.max_users,
            'max_professionals', v_plan.max_professionals,
            'max_clients', v_plan.max_clients
        ),
        'features', COALESCE(v_features, '{}'::jsonb)
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_current_subscription FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_subscription TO authenticated;

-- 14. RPC: master_create_organization_existing_admin (Cenário A)
CREATE OR REPLACE FUNCTION public.master_create_organization_existing_admin(
    p_name TEXT,
    p_admin_user_id UUID,
    p_saas_plan_id UUID,
    p_billing_cycle TEXT DEFAULT 'monthly',
    p_phone TEXT DEFAULT NULL,
    p_whatsapp TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_logo_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id UUID;
    v_org_id UUID;
    v_plan_price NUMERIC(10,2);
    v_sub_id UUID;
BEGIN
    v_calling_user_id := auth.uid();
    IF NOT public.user_is_master(v_calling_user_id) THEN
        RAISE EXCEPTION 'Acesso negado: Somente Master pode criar salões.';
    END IF;

    -- Buscar preço do plano
    SELECT CASE WHEN p_billing_cycle = 'yearly' THEN yearly_price ELSE monthly_price END
    INTO v_plan_price
    FROM public.saas_plans
    WHERE id = p_saas_plan_id AND is_active = true;

    IF v_plan_price IS NULL THEN
        RAISE EXCEPTION 'Plano SaaS inválido ou inativo.';
    END IF;

    -- 1. Criar organização
    INSERT INTO public.organizations (name, phone, whatsapp, city, state, logo_url, status, provisioning_status)
    VALUES (p_name, p_phone, p_whatsapp, p_city, p_state, p_logo_url, 'active', 'ready')
    RETURNING id INTO v_org_id;

    -- 2. Vincular Admin em organization_users
    INSERT INTO public.organization_users (organization_id, user_id, role, is_active)
    VALUES (v_org_id, p_admin_user_id, 'admin', true)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'admin', is_active = true;

    -- 3. Criar Assinatura
    INSERT INTO public.organization_subscriptions (
        organization_id, saas_plan_id, status, billing_cycle, price_snapshot, current_period_start, current_period_end
    ) VALUES (
        v_org_id, p_saas_plan_id, 'active', p_billing_cycle, v_plan_price, NOW(), NOW() + INTERVAL '1 month'
    ) RETURNING id INTO v_sub_id;

    -- 4. Inserir Evento de Assinatura
    INSERT INTO public.subscription_events (
        organization_subscription_id, organization_id, event_type, new_plan_id, new_status, created_by
    ) VALUES (
        v_sub_id, v_org_id, 'created', p_saas_plan_id, 'active', v_calling_user_id
    );

    -- 5. Seed de categorias financeiras padrão
    INSERT INTO public.financial_categories (organization_id, name, type, is_system)
    VALUES
        (v_org_id, 'Serviços Prestados', 'income', true),
        (v_org_id, 'Venda de Produtos', 'income', true),
        (v_org_id, 'Venda de Pacotes', 'income', true),
        (v_org_id, 'Comissões', 'expense', true),
        (v_org_id, 'Fornecedores', 'expense', true),
        (v_org_id, 'Aluguel e Contas', 'expense', true),
        (v_org_id, 'Outras Despesas', 'expense', true)
    ON CONFLICT DO NOTHING;

    -- 6. Auditoria Master
    INSERT INTO public.master_audit_logs (
        master_user_id, action, entity_type, entity_id, organization_id, after_data
    ) VALUES (
        v_calling_user_id, 'create_organization_existing_admin', 'organization', v_org_id, v_org_id,
        jsonb_build_object('name', p_name, 'admin_user_id', p_admin_user_id, 'plan_id', p_saas_plan_id)
    );

    RETURN jsonb_build_object('success', true, 'organization_id', v_org_id, 'subscription_id', v_sub_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.master_create_organization_existing_admin FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.master_create_organization_existing_admin TO authenticated;

-- 15. RPC: master_set_organization_status
CREATE OR REPLACE FUNCTION public.master_set_organization_status(
    p_org_id UUID,
    p_new_status TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id UUID;
    v_old_status TEXT;
BEGIN
    v_calling_user_id := auth.uid();
    IF NOT public.user_is_master(v_calling_user_id) THEN
        RAISE EXCEPTION 'Acesso negado: Somente Master pode alterar o status do salão.';
    END IF;

    IF p_new_status NOT IN ('active', 'suspended', 'archived') THEN
        RAISE EXCEPTION 'Status inválido. Escolha active, suspended ou archived.';
    END IF;

    SELECT status INTO v_old_status FROM public.organizations WHERE id = p_org_id;
    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Organização não encontrada.';
    END IF;

    UPDATE public.organizations
    SET status = p_new_status,
        suspended_at = CASE WHEN p_new_status = 'suspended' THEN NOW() ELSE suspended_at END,
        archived_at = CASE WHEN p_new_status = 'archived' THEN NOW() ELSE archived_at END,
        archived_by = CASE WHEN p_new_status = 'archived' THEN v_calling_user_id ELSE archived_by END,
        archive_reason = CASE WHEN p_new_status = 'archived' THEN p_reason ELSE archive_reason END,
        updated_at = NOW()
    WHERE id = p_org_id;

    -- Auditoria
    INSERT INTO public.master_audit_logs (
        master_user_id, action, entity_type, entity_id, organization_id, before_data, after_data
    ) VALUES (
        v_calling_user_id, 'set_organization_status', 'organization', p_org_id, p_org_id,
        jsonb_build_object('status', v_old_status),
        jsonb_build_object('status', p_new_status, 'reason', p_reason)
    );

    RETURN jsonb_build_object('success', true, 'old_status', v_old_status, 'new_status', p_new_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.master_set_organization_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.master_set_organization_status TO authenticated;

-- 16. RPC: master_get_global_kpis
CREATE OR REPLACE FUNCTION public.master_get_global_kpis()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user_id UUID;
    v_active_tenants INT;
    v_trial_tenants INT;
    v_suspended_tenants INT;
    v_mrr NUMERIC(10,2);
    v_arr NUMERIC(10,2);
    v_total_users INT;
    v_total_clients INT;
BEGIN
    v_calling_user_id := auth.uid();
    IF NOT public.user_is_master(v_calling_user_id) THEN
        RAISE EXCEPTION 'Acesso negado: Somente Master pode consultar KPIs globais.';
    END IF;

    SELECT COUNT(*) INTO v_active_tenants FROM public.organizations WHERE status = 'active';
    SELECT COUNT(*) INTO v_suspended_tenants FROM public.organizations WHERE status = 'suspended';
    
    SELECT COUNT(*) INTO v_trial_tenants 
    FROM public.organization_subscriptions WHERE status = 'trial';

    SELECT COALESCE(SUM(price_snapshot), 0.00) INTO v_mrr
    FROM public.organization_subscriptions WHERE status = 'active';

    v_arr := v_mrr * 12;

    SELECT COUNT(*) INTO v_total_users FROM public.profiles;
    SELECT COUNT(*) INTO v_total_clients FROM public.clients;

    RETURN jsonb_build_object(
        'active_tenants', v_active_tenants,
        'trial_tenants', v_trial_tenants,
        'suspended_tenants', v_suspended_tenants,
        'mrr', v_mrr,
        'arr', v_arr,
        'total_users', v_total_users,
        'total_clients', v_total_clients
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.master_get_global_kpis FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.master_get_global_kpis TO authenticated;

-- 17. Políticas RLS para Tabelas Master
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- saas_plans: Usuários autenticados podem ver ativos, somente Master gerencia
CREATE POLICY "RLS Select saas_plans" ON public.saas_plans FOR SELECT TO authenticated USING (is_active = true OR public.user_is_master(auth.uid()));
CREATE POLICY "RLS Manage saas_plans" ON public.saas_plans FOR ALL TO authenticated USING (public.user_is_master(auth.uid()));

-- saas_plan_features: Visível por autenticados, gerido por Master
CREATE POLICY "RLS Select saas_plan_features" ON public.saas_plan_features FOR SELECT TO authenticated USING (true);
CREATE POLICY "RLS Manage saas_plan_features" ON public.saas_plan_features FOR ALL TO authenticated USING (public.user_is_master(auth.uid()));

-- organization_subscriptions & subscription_events & tenant_backups & platform_settings: Master total
CREATE POLICY "RLS Master organization_subscriptions" ON public.organization_subscriptions FOR ALL TO authenticated USING (public.user_is_master(auth.uid()));
CREATE POLICY "RLS Master subscription_events" ON public.subscription_events FOR ALL TO authenticated USING (public.user_is_master(auth.uid()));
CREATE POLICY "RLS Master tenant_backups" ON public.tenant_backups FOR ALL TO authenticated USING (public.user_is_master(auth.uid()));
CREATE POLICY "RLS Master platform_settings" ON public.platform_settings FOR ALL TO authenticated USING (public.user_is_master(auth.uid()));

-- master_audit_logs: INSERT only e SELECT pelo Master
CREATE POLICY "RLS Select master_audit_logs" ON public.master_audit_logs FOR SELECT TO authenticated USING (public.user_is_master(auth.uid()));
CREATE POLICY "RLS Insert master_audit_logs" ON public.master_audit_logs FOR INSERT TO authenticated WITH CHECK (public.user_is_master(auth.uid()));

COMMIT;
