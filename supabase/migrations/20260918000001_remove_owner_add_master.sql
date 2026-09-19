-- Migration 20260918000001: Remove 'owner' role, add 'admin' as salon owner, add 'system_role' ('master' | 'user') to profiles
-- Strictly separates platform administration (system_role = master) from tenant membership (organization_users.role = admin | receptionist | professional).
-- Sanitizes all functional RLS policies and RPCs across Sprint 1-6 to eliminate 'owner'.

BEGIN;

-- 1. Adicionar sistema de papéis globais na tabela profiles (master / user)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS system_role VARCHAR(20) NOT NULL DEFAULT 'user';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_system_role'
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT chk_profiles_system_role CHECK (system_role IN ('master', 'user'));
    END IF;
END $$;

-- 2. Migrar todos os usuários com papel 'owner' para 'admin' na tabela organization_users
UPDATE public.organization_users
SET role = 'admin'
WHERE role = 'owner';

-- 3. Atualizar constraint da tabela organization_users (permitir apenas admin, receptionist, professional)
ALTER TABLE public.organization_users DROP CONSTRAINT IF EXISTS chk_organization_users_role;
ALTER TABLE public.organization_users DROP CONSTRAINT IF EXISTS organization_users_role_check;

ALTER TABLE public.organization_users
ADD CONSTRAINT chk_organization_users_role CHECK (role IN ('admin', 'receptionist', 'professional'));

-- 4. Criar helper exclusivo para verificação de Master Global
CREATE OR REPLACE FUNCTION public.user_is_master(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND system_role = 'master'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.user_is_master(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_master(UUID) TO authenticated;

-- 5. Atualizar helper de autorização de tenant (valida estritamente organization_users, sem bypass silencioso de RLS)
CREATE OR REPLACE FUNCTION public.user_has_org_role(
  p_org_id UUID,
  p_allowed_roles TEXT[] DEFAULT ARRAY['admin', 'receptionist', 'professional']
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_role
  FROM public.organization_users
  WHERE organization_id = p_org_id
    AND user_id = v_user_id
    AND is_active = TRUE;

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_role = ANY(p_allowed_roles);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.user_has_org_role(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_org_role(UUID, TEXT[]) TO authenticated;

-- 6. Atualizar check_report_access para usar 'admin' (sem 'owner')
CREATE OR REPLACE FUNCTION public.check_report_access(
    p_org_id UUID,
    p_required_roles TEXT[] DEFAULT ARRAY['admin', 'receptionist', 'professional']
)
RETURNS TABLE (
    out_user_id UUID,
    out_user_role TEXT,
    out_professional_id UUID,
    out_org_timezone TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_role TEXT;
    v_prof_id UUID;
    v_tz TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado.';
    END IF;

    -- Verificar pertencimento e status do usuário no tenant
    SELECT ou.role INTO v_role
    FROM public.organization_users ou
    WHERE ou.user_id = v_user_id
      AND ou.organization_id = p_org_id
      AND ou.is_active = TRUE;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado ao tenant.';
    END IF;

    IF NOT (v_role = ANY(p_required_roles)) THEN
        RAISE EXCEPTION 'Permissão insuficiente para este relatório.';
    END IF;

    -- Obter professional_id (se houver vínculo)
    SELECT p.id INTO v_prof_id
    FROM public.professionals p
    WHERE p.user_id = v_user_id
      AND p.organization_id = p_org_id
      AND p.is_active = TRUE
    LIMIT 1;

    -- Obter timezone da organização
    SELECT o.timezone INTO v_tz
    FROM public.organizations o
    WHERE o.id = p_org_id;

    IF v_tz IS NULL THEN
        v_tz := 'America/Sao_Paulo';
    END IF;

    out_user_id := v_user_id;
    out_user_role := v_role;
    out_professional_id := v_prof_id;
    out_org_timezone := v_tz;
    RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_report_access(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_report_access(UUID, TEXT[]) TO authenticated;

-- 7. Criar nova RPC de Onboarding create_organization_with_admin (suporta city, state, primary_color, secondary_color)
DROP FUNCTION IF EXISTS public.create_organization_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_organization_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
    p_name TEXT,
    p_phone TEXT DEFAULT NULL,
    p_whatsapp TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_logo_url TEXT DEFAULT NULL,
    p_primary_color TEXT DEFAULT NULL,
    p_secondary_color TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_slug TEXT;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substring(gen_random_uuid()::text, 1, 6);

    INSERT INTO public.organizations (
        name, slug, phone, whatsapp, city, state, logo_url, primary_color, secondary_color, is_active
    ) VALUES (
        p_name, v_slug, p_phone, p_whatsapp, p_city, p_state, p_logo_url,
        COALESCE(p_primary_color, '#0f172a'),
        COALESCE(p_secondary_color, '#64748b'),
        TRUE
    )
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_users (
        organization_id, user_id, role, is_active
    ) VALUES (
        v_org_id, v_user_id, 'admin', TRUE
    );

    SELECT jsonb_build_object(
        'id', id,
        'name', name,
        'slug', slug,
        'primary_color', primary_color,
        'secondary_color', secondary_color,
        'logo_url', logo_url,
        'created_at', created_at
    ) INTO v_result
    FROM public.organizations
    WHERE id = v_org_id;

    RETURN v_result;
END;
$$;

-- Overload de compatibilidade para chamada com p_primary_color e p_secondary_color do onboarding
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
    p_name TEXT,
    p_phone TEXT,
    p_whatsapp TEXT,
    p_primary_color TEXT,
    p_secondary_color TEXT,
    p_logo_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.create_organization_with_admin(
        p_name => p_name,
        p_phone => p_phone,
        p_whatsapp => p_whatsapp,
        p_city => NULL,
        p_state => NULL,
        p_logo_url => p_logo_url,
        p_primary_color => p_primary_color,
        p_secondary_color => p_secondary_color
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_organization_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_organization_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Wrapper de compatibilidade temporária para create_organization_with_owner (DEPRECATED)
DROP FUNCTION IF EXISTS public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
    p_name TEXT,
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
BEGIN
    RETURN public.create_organization_with_admin(
        p_name => p_name,
        p_phone => p_phone,
        p_whatsapp => p_whatsapp,
        p_city => p_city,
        p_state => p_state,
        p_logo_url => p_logo_url,
        p_primary_color => NULL,
        p_secondary_color => NULL
    );
END;
$$;

COMMENT ON FUNCTION public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
IS 'DEPRECATED: use create_organization_with_admin';

REVOKE EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 8. Atualizar Políticas RLS de tabelas de domínio para usar 'admin' em vez de 'owner'
DO $$
BEGIN
  -- Sprint 1: Organizations, Organization_Users, Professionals, Service_Categories, Services, Professional_Services
  DROP POLICY IF EXISTS "Somente Owner e Admin podem atualizar organização" ON public.organizations;
  DROP POLICY IF EXISTS "RLS Update organizations" ON public.organizations;
  CREATE POLICY "RLS Update organizations" ON public.organizations FOR UPDATE USING (public.user_has_org_role(id, ARRAY['admin']));

  DROP POLICY IF EXISTS "Somente Owner e Admin podem adicionar membros" ON public.organization_users;
  DROP POLICY IF EXISTS "Somente Owner e Admin podem atualizar membros" ON public.organization_users;
  DROP POLICY IF EXISTS "RLS Insert organization_users" ON public.organization_users;
  DROP POLICY IF EXISTS "RLS Update organization_users" ON public.organization_users;
  CREATE POLICY "RLS Insert organization_users" ON public.organization_users FOR INSERT WITH CHECK (public.user_has_org_role(organization_id, ARRAY['admin']));
  CREATE POLICY "RLS Update organization_users" ON public.organization_users FOR UPDATE USING (public.user_has_org_role(organization_id, ARRAY['admin']));

  DROP POLICY IF EXISTS "Somente Admin/Owner podem inserir profissionais" ON public.professionals;
  DROP POLICY IF EXISTS "Somente Admin/Owner podem atualizar profissionais" ON public.professionals;
  DROP POLICY IF EXISTS "RLS Insert professionals" ON public.professionals;
  DROP POLICY IF EXISTS "RLS Update professionals" ON public.professionals;
  CREATE POLICY "RLS Insert professionals" ON public.professionals FOR INSERT WITH CHECK (public.user_has_org_role(organization_id, ARRAY['admin']));
  CREATE POLICY "RLS Update professionals" ON public.professionals FOR UPDATE USING (public.user_has_org_role(organization_id, ARRAY['admin']));

  DROP POLICY IF EXISTS "Somente Admin/Owner podem inserir categorias" ON public.service_categories;
  DROP POLICY IF EXISTS "Somente Admin/Owner podem atualizar categorias" ON public.service_categories;
  DROP POLICY IF EXISTS "RLS Insert service_categories" ON public.service_categories;
  DROP POLICY IF EXISTS "RLS Update service_categories" ON public.service_categories;
  CREATE POLICY "RLS Insert service_categories" ON public.service_categories FOR INSERT WITH CHECK (public.user_has_org_role(organization_id, ARRAY['admin']));
  CREATE POLICY "RLS Update service_categories" ON public.service_categories FOR UPDATE USING (public.user_has_org_role(organization_id, ARRAY['admin']));

  DROP POLICY IF EXISTS "Somente Admin/Owner podem inserir serviços" ON public.services;
  DROP POLICY IF EXISTS "Somente Admin/Owner podem atualizar serviços" ON public.services;
  DROP POLICY IF EXISTS "RLS Insert services" ON public.services;
  DROP POLICY IF EXISTS "RLS Update services" ON public.services;
  CREATE POLICY "RLS Insert services" ON public.services FOR INSERT WITH CHECK (public.user_has_org_role(organization_id, ARRAY['admin']));
  CREATE POLICY "RLS Update services" ON public.services FOR UPDATE USING (public.user_has_org_role(organization_id, ARRAY['admin']));

  DROP POLICY IF EXISTS "Somente Admin/Owner podem gerenciar Serviços do Profissional" ON public.professional_services;
  DROP POLICY IF EXISTS "RLS Manage professional_services" ON public.professional_services;
  CREATE POLICY "RLS Manage professional_services" ON public.professional_services FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin']));

  -- Sprint 3: Client_Service_Frequencies, Return_Alerts, Message_Templates
  DROP POLICY IF EXISTS "RLS Manage client_service_frequencies" ON public.client_service_frequencies;
  CREATE POLICY "RLS Manage client_service_frequencies" ON public.client_service_frequencies FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin', 'receptionist']));

  DROP POLICY IF EXISTS "RLS Manage return_alerts" ON public.return_alerts;
  CREATE POLICY "RLS Manage return_alerts" ON public.return_alerts FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin', 'receptionist']));

  DROP POLICY IF EXISTS "RLS Manage message_templates" ON public.message_templates;
  CREATE POLICY "RLS Manage message_templates" ON public.message_templates FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin']));

  -- Sprint 4 & 5 Financial & Package policies
  DROP POLICY IF EXISTS "RLS Manage financial_categories" ON public.financial_categories;
  CREATE POLICY "RLS Manage financial_categories" ON public.financial_categories FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin']));

  DROP POLICY IF EXISTS "RLS Manage cash_registers" ON public.cash_registers;
  CREATE POLICY "RLS Manage cash_registers" ON public.cash_registers FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin', 'receptionist']));

  DROP POLICY IF EXISTS "RLS Manage cash_movements" ON public.cash_movements;
  CREATE POLICY "RLS Manage cash_movements" ON public.cash_movements FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin', 'receptionist']));

  DROP POLICY IF EXISTS "RLS Manage financial_transactions" ON public.financial_transactions;
  CREATE POLICY "RLS Manage financial_transactions" ON public.financial_transactions FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin', 'receptionist']));

  DROP POLICY IF EXISTS "RLS Manage accounts_receivable" ON public.accounts_receivable;
  CREATE POLICY "RLS Manage accounts_receivable" ON public.accounts_receivable FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin', 'receptionist']));

  DROP POLICY IF EXISTS "RLS Manage accounts_payable" ON public.accounts_payable;
  CREATE POLICY "RLS Manage accounts_payable" ON public.accounts_payable FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin']));

  DROP POLICY IF EXISTS "RLS Manage account_payable_payments" ON public.account_payable_payments;
  CREATE POLICY "RLS Manage account_payable_payments" ON public.account_payable_payments FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin']));

  DROP POLICY IF EXISTS "RLS Manage commissions" ON public.commissions;
  CREATE POLICY "RLS Manage commissions" ON public.commissions FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin']));

  DROP POLICY IF EXISTS "RLS Manage commission_items" ON public.commission_items;
  CREATE POLICY "RLS Manage commission_items" ON public.commission_items FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin']));

  DROP POLICY IF EXISTS "RLS Manage packages" ON public.packages;
  CREATE POLICY "RLS Manage packages" ON public.packages FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin']));

  DROP POLICY IF EXISTS "RLS Manage package_items" ON public.package_items;
  CREATE POLICY "RLS Manage package_items" ON public.package_items FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin']));

  DROP POLICY IF EXISTS "RLS Manage package_rules" ON public.package_rules;
  CREATE POLICY "RLS Manage package_rules" ON public.package_rules FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin']));

  DROP POLICY IF EXISTS "RLS Manage client_packages" ON public.client_packages;
  CREATE POLICY "RLS Manage client_packages" ON public.client_packages FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin', 'receptionist']));

  DROP POLICY IF EXISTS "RLS Manage client_package_items" ON public.client_package_items;
  CREATE POLICY "RLS Manage client_package_items" ON public.client_package_items FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin', 'receptionist']));

  DROP POLICY IF EXISTS "RLS Manage client_package_rules" ON public.client_package_rules;
  CREATE POLICY "RLS Manage client_package_rules" ON public.client_package_rules FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin', 'receptionist']));

  DROP POLICY IF EXISTS "RLS Manage client_package_payments" ON public.client_package_payments;
  CREATE POLICY "RLS Manage client_package_payments" ON public.client_package_payments FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin', 'receptionist']));

  DROP POLICY IF EXISTS "RLS Manage payment_methods" ON public.payment_methods;
  CREATE POLICY "RLS Manage payment_methods" ON public.payment_methods FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['admin']));
END $$;

-- 9. Saneamento de RPCs Operacionais (Sprint 3, 4, 5)

-- Sprint 3 RPC
CREATE OR REPLACE FUNCTION public.set_manual_service_frequency(p_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_client_id UUID;
    v_service_id UUID;
    v_manual_days INT;
    v_user_role TEXT;
    v_res JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Acesso negado: Não autenticado.'; END IF;

    v_org_id := (p_data->>'organization_id')::UUID;
    v_client_id := (p_data->>'client_id')::UUID;
    v_service_id := (p_data->>'service_id')::UUID;
    v_manual_days := NULLIF((p_data->>'manual_interval_days')::INT, 0);

    IF NOT public.user_belongs_to_org(v_org_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

    SELECT role INTO v_user_role FROM public.organization_users
    WHERE organization_id = v_org_id AND user_id = v_user_id AND is_active = TRUE;

    IF v_user_role NOT IN ('admin', 'receptionist') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil sem permissão para alterar frequência manual.';
    END IF;

    INSERT INTO public.client_service_frequencies (
        organization_id, client_id, service_id, manual_interval_days, updated_at
    ) VALUES (
        v_org_id, v_client_id, v_service_id, v_manual_days, NOW()
    ) ON CONFLICT (organization_id, client_id, service_id) DO UPDATE SET
        manual_interval_days = EXCLUDED.manual_interval_days,
        updated_at = NOW();

    PERFORM public.recalculate_client_service_frequency(v_client_id, v_service_id, v_org_id);

    SELECT to_jsonb(csf.*) INTO v_res
    FROM public.client_service_frequencies csf
    WHERE organization_id = v_org_id AND client_id = v_client_id AND service_id = v_service_id;

    RETURN v_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.set_manual_service_frequency(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_manual_service_frequency(JSONB) TO authenticated;

-- Sprint 4 RPCs
CREATE OR REPLACE FUNCTION public.sell_client_package(p_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_client_id UUID;
    v_package_id UUID;
    v_user_role TEXT;
    v_starts_at TIMESTAMPTZ;
    v_expires_at TIMESTAMPTZ;
    v_pkg RECORD;
    v_cp_id UUID;
    v_discount NUMERIC(12,2) := 0.00;
    v_final_price NUMERIC(12,2) := 0.00;
    v_notes TEXT;
    v_renewed_from UUID;
    v_item RECORD;
    v_cpi_id UUID;
    v_rule RECORD;
    v_cpr_id UUID;
    v_payment JSONB;
    v_pay_amount NUMERIC(12,2);
    v_pay_method_id UUID;
    v_pay_notes TEXT;
    v_tot_paid NUMERIC(12,2) := 0.00;
    v_rem_amount NUMERIC(12,2) := 0.00;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.'; END IF;

    v_org_id := (p_data->>'organization_id')::UUID;
    v_client_id := (p_data->>'client_id')::UUID;
    v_package_id := (p_data->>'package_id')::UUID;

    IF NOT public.user_belongs_to_org(v_org_id) THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não pertence a esta organização.';
    END IF;

    SELECT role INTO v_user_role
    FROM public.organization_users
    WHERE organization_id = v_org_id AND user_id = v_user_id AND is_active = TRUE;

    IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'receptionist') THEN
        RAISE EXCEPTION 'Acesso negado: Somente administradores e recepcionistas podem vender pacotes.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE clients.id = v_client_id AND clients.organization_id = v_org_id AND clients.is_active = TRUE) THEN
        RAISE EXCEPTION 'Erro: Cliente inválido ou inativo nesta organização.';
    END IF;

    SELECT * INTO v_pkg FROM public.packages WHERE packages.id = v_package_id AND packages.organization_id = v_org_id AND packages.is_active = TRUE;
    IF v_pkg.id IS NULL THEN
        RAISE EXCEPTION 'Erro: Pacote/Plano comercial inválido ou inativo nesta organização.';
    END IF;

    v_starts_at := COALESCE((p_data->>'starts_at')::TIMESTAMPTZ, NOW());
    v_discount := COALESCE((p_data->>'discount')::NUMERIC, 0.00);
    v_notes := p_data->>'notes';
    v_renewed_from := (p_data->>'renewed_from_client_package_id')::UUID;

    IF v_pkg.validity_days IS NOT NULL THEN
        v_expires_at := v_starts_at + (v_pkg.validity_days || ' days')::INTERVAL;
    ELSE
        v_expires_at := NULL;
    END IF;

    v_final_price := GREATEST(0.00, v_pkg.price - v_discount);

    INSERT INTO public.client_packages (
        organization_id, client_id, package_id, package_name_snapshot, price_snapshot, discount, final_price, status, starts_at, expires_at, notes, renewed_from_client_package_id, created_by
    ) VALUES (
        v_org_id, v_client_id, v_package_id, v_pkg.name, v_pkg.price, v_discount, v_final_price, 'active', v_starts_at, v_expires_at, v_notes, v_renewed_from, v_user_id
    ) RETURNING id INTO v_cp_id;

    FOR v_item IN SELECT * FROM public.package_items WHERE package_id = v_package_id LOOP
        INSERT INTO public.client_package_items (
            client_package_id, service_id, initial_quantity, used_quantity, remaining_quantity
        ) VALUES (
            v_cp_id, v_item.service_id, v_item.quantity, 0, v_item.quantity
        );
    END LOOP;

    FOR v_rule IN SELECT * FROM public.package_rules WHERE package_id = v_package_id LOOP
        INSERT INTO public.client_package_rules (
            client_package_id, rule_type, rule_value
        ) VALUES (
            v_cp_id, v_rule.rule_type, v_rule.rule_value
        );
    END LOOP;

    IF p_data->'payments' IS NOT NULL AND jsonb_array_length(p_data->'payments') > 0 THEN
        FOR v_payment IN SELECT * FROM jsonb_array_elements(p_data->'payments') LOOP
            v_pay_amount := (v_payment->>'amount')::NUMERIC;
            v_pay_method_id := (v_payment->>'payment_method_id')::UUID;
            v_pay_notes := v_payment->>'notes';

            IF v_pay_amount > 0 AND v_pay_method_id IS NOT NULL THEN
                INSERT INTO public.client_package_payments (
                    client_package_id, organization_id, payment_method_id, amount, notes, created_by
                ) VALUES (
                    v_cp_id, v_org_id, v_pay_method_id, v_pay_amount, v_pay_notes, v_user_id
                );
                v_tot_paid := v_tot_paid + v_pay_amount;
            END IF;
        END LOOP;
    END IF;

    v_rem_amount := GREATEST(0.00, v_final_price - v_tot_paid);

    IF v_rem_amount > 0 THEN
        INSERT INTO public.accounts_receivable (
            organization_id, client_id, description, original_amount, paid_amount, remaining_amount, due_date, status, created_by
        ) VALUES (
            v_org_id, v_client_id, 'Pacote do Cliente: ' || v_pkg.name, v_final_price, v_tot_paid, v_rem_amount, CURRENT_DATE + INTERVAL '30 days', 'pending', v_user_id
        );
    END IF;

    SELECT to_jsonb(cp.*) INTO v_result FROM public.client_packages cp WHERE cp.id = v_cp_id;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.sell_client_package(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sell_client_package(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_client_package(p_client_package_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_user_role TEXT;
    v_cp RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.'; END IF;

    SELECT * INTO v_cp FROM public.client_packages WHERE client_packages.id = p_client_package_id;
    IF v_cp.id IS NULL THEN RAISE EXCEPTION 'Erro: Pacote do cliente não encontrado.'; END IF;
    v_org_id := v_cp.organization_id;

    SELECT role INTO v_user_role FROM public.organization_users WHERE organization_id = v_org_id AND user_id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL OR v_user_role != 'admin' THEN
        RAISE EXCEPTION 'Acesso negado: Somente administradores podem cancelar pacotes vendidos.';
    END IF;

    IF v_cp.status = 'cancelled' THEN
        RAISE EXCEPTION 'Erro: Este pacote já se encontra cancelado.';
    END IF;

    UPDATE public.client_packages
    SET status = 'cancelled',
        notes = COALESCE(notes || ' | Cancelamento: ' || p_reason, 'Cancelamento: ' || p_reason),
        updated_at = NOW()
    WHERE client_packages.id = p_client_package_id;

    RETURN jsonb_build_object('success', true, 'id', p_client_package_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.cancel_client_package(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_client_package(UUID, TEXT) TO authenticated;

-- Sprint 5 RPCs
DROP FUNCTION IF EXISTS public.open_cash_register(NUMERIC, UUID);
DROP FUNCTION IF EXISTS public.open_cash_register(UUID, NUMERIC);
CREATE OR REPLACE FUNCTION public.open_cash_register(p_org_id UUID, p_opening_balance NUMERIC(12,2) DEFAULT 0.00)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_cash_reg_id UUID;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.'; END IF;

    IF NOT public.user_belongs_to_org(p_org_id) THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não pertence a esta organização.';
    END IF;

    SELECT role INTO v_user_role FROM public.organization_users WHERE organization_id = p_org_id AND user_id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'receptionist') THEN
        RAISE EXCEPTION 'Acesso negado: Permissão insuficiente para abrir caixa.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.cash_registers WHERE organization_id = p_org_id AND status = 'open') THEN
        RAISE EXCEPTION 'Erro: Já existe um caixa aberto para esta organização.';
    END IF;

    IF p_opening_balance < 0 THEN RAISE EXCEPTION 'Erro: O saldo de abertura não pode ser negativo.'; END IF;

    PERFORM public.seed_default_financial_categories(p_org_id);

    INSERT INTO public.cash_registers (
        organization_id, opened_at, opened_by, opening_balance, status
    ) VALUES (
        p_org_id, NOW(), v_user_id, p_opening_balance, 'open'
    ) RETURNING id INTO v_cash_reg_id;

    INSERT INTO public.cash_movements (
        organization_id, cash_register_id, type, amount, description, created_by
    ) VALUES (
        p_org_id, v_cash_reg_id, 'opening', p_opening_balance, 'Saldo Inicial de Abertura de Caixa', v_user_id
    );

    SELECT jsonb_build_object(
        'id', cr.id,
        'organization_id', cr.organization_id,
        'opened_at', cr.opened_at,
        'opening_balance', cr.opening_balance,
        'status', cr.status
    ) INTO v_result FROM public.cash_registers cr WHERE cr.id = v_cash_reg_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.open_cash_register(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_cash_register(UUID, NUMERIC) TO authenticated;

DROP FUNCTION IF EXISTS public.close_cash_register(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.close_cash_register(UUID, NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION public.close_cash_register(p_cash_register_id UUID, p_actual_closing_balance NUMERIC(12,2), p_notes TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_cr RECORD;
    v_expected NUMERIC(12,2) := 0.00;
    v_diff NUMERIC(12,2) := 0.00;
    v_sales_cash NUMERIC(12,2) := 0.00;
    v_supplies NUMERIC(12,2) := 0.00;
    v_withdrawals NUMERIC(12,2) := 0.00;
    v_expenses_cash NUMERIC(12,2) := 0.00;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.'; END IF;

    SELECT * INTO v_cr FROM public.cash_registers WHERE cash_registers.id = p_cash_register_id FOR UPDATE;
    IF v_cr.id IS NULL THEN RAISE EXCEPTION 'Erro: Caixa não encontrado.'; END IF;

    SELECT role INTO v_user_role FROM public.organization_users WHERE organization_id = v_cr.organization_id AND user_id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'receptionist') THEN
        RAISE EXCEPTION 'Acesso negado: Permissão insuficiente para fechar caixa.';
    END IF;

    IF v_cr.status = 'closed' THEN RAISE EXCEPTION 'Erro: Este caixa já foi fechado anteriormente e é imutável.'; END IF;

    SELECT COALESCE(SUM(amount), 0.00) INTO v_sales_cash FROM public.cash_movements WHERE cash_register_id = p_cash_register_id AND type IN ('sale', 'receipt');
    SELECT COALESCE(SUM(amount), 0.00) INTO v_supplies FROM public.cash_movements WHERE cash_register_id = p_cash_register_id AND type = 'supply';
    SELECT COALESCE(SUM(amount), 0.00) INTO v_withdrawals FROM public.cash_movements WHERE cash_register_id = p_cash_register_id AND type = 'withdrawal';
    SELECT COALESCE(SUM(amount), 0.00) INTO v_expenses_cash FROM public.cash_movements WHERE cash_register_id = p_cash_register_id AND type = 'expense';

    v_expected := v_cr.opening_balance + v_sales_cash + v_supplies - v_withdrawals - v_expenses_cash;
    v_diff := p_actual_closing_balance - v_expected;

    UPDATE public.cash_registers SET
        status = 'closed',
        closed_at = NOW(),
        closed_by = v_user_id,
        closing_balance = p_actual_closing_balance,
        expected_balance = v_expected,
        difference = v_diff,
        notes = p_notes,
        updated_at = NOW()
    WHERE cash_registers.id = p_cash_register_id;

    IF v_diff != 0 THEN
        INSERT INTO public.cash_movements (
            organization_id, cash_register_id, type, amount, description, created_by
        ) VALUES (
            v_cr.organization_id, p_cash_register_id, 'closing_adjustment', v_diff, 'Ajuste de Divergência no Fechamento de Caixa', v_user_id
        );
    END IF;

    SELECT to_jsonb(cr.*) INTO v_result FROM public.cash_registers cr WHERE cr.id = p_cash_register_id;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.close_cash_register(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_cash_register(UUID, NUMERIC, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.pay_account_receivable(UUID, NUMERIC, UUID);
DROP FUNCTION IF EXISTS public.pay_account_receivable(UUID, UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.pay_account_receivable(UUID, UUID, NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION public.pay_account_receivable(p_account_receivable_id UUID, p_payment_method_id UUID, p_amount NUMERIC(12,2), p_notes TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_user_role TEXT;
    v_ar RECORD;
    v_pm RECORD;
    v_cr RECORD;
    v_new_paid NUMERIC(12,2);
    v_new_rem NUMERIC(12,2);
    v_status TEXT;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.'; END IF;

    SELECT * INTO v_ar FROM public.accounts_receivable WHERE accounts_receivable.id = p_account_receivable_id FOR UPDATE;
    IF v_ar.id IS NULL THEN RAISE EXCEPTION 'Erro: Conta a receber não encontrada.'; END IF;
    v_org_id := v_ar.organization_id;

    SELECT role INTO v_user_role FROM public.organization_users WHERE organization_id = v_org_id AND user_id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'receptionist') THEN
        RAISE EXCEPTION 'Acesso negado: Permissão insuficiente para dar baixa em contas a receber.';
    END IF;

    IF v_ar.status = 'paid' OR v_ar.remaining_amount <= 0 THEN
        RAISE EXCEPTION 'Erro: Esta conta a receber já está totalmente quitada.';
    END IF;

    IF p_amount <= 0 THEN RAISE EXCEPTION 'Erro: O valor do pagamento deve ser maior que 0.'; END IF;
    IF p_amount > v_ar.remaining_amount THEN
        RAISE EXCEPTION 'Erro: O valor do pagamento (R$ %) não pode ser maior do que o saldo a receber (R$ %).', p_amount, v_ar.remaining_amount;
    END IF;

    SELECT * INTO v_pm FROM public.payment_methods WHERE payment_methods.id = p_payment_method_id AND payment_methods.organization_id = v_org_id AND payment_methods.is_active = TRUE;
    IF v_pm.id IS NULL THEN RAISE EXCEPTION 'Erro: Forma de pagamento inválida ou inativa.'; END IF;

    IF v_pm.type = 'cash' THEN
        SELECT * INTO v_cr FROM public.cash_registers WHERE organization_id = v_org_id AND status = 'open';
        IF v_cr.id IS NULL THEN
            RAISE EXCEPTION 'Erro: Para recebimentos em dinheiro (espécie), o caixa físico da organização precisa estar aberto.';
        END IF;
    END IF;

    v_new_paid := v_ar.paid_amount + p_amount;
    v_new_rem := v_ar.remaining_amount - p_amount;
    IF v_new_rem <= 0 THEN v_status := 'paid'; ELSE v_status := 'partial'; END IF;

    UPDATE public.accounts_receivable SET
        paid_amount = v_new_paid,
        remaining_amount = v_new_rem,
        status = v_status,
        updated_at = NOW()
    WHERE accounts_receivable.id = p_account_receivable_id;

    IF v_pm.type = 'cash' AND v_cr.id IS NOT NULL THEN
        INSERT INTO public.cash_movements (
            organization_id, cash_register_id, type, amount, description, created_by
        ) VALUES (
            v_org_id, v_cr.id, 'receipt', p_amount, 'Recebimento de Conta: ' || v_ar.description, v_user_id
        );
    END IF;

    INSERT INTO public.financial_transactions (
        organization_id, type, amount, description, payment_method_id, account_receivable_id, created_by
    ) VALUES (
        v_org_id, 'income', p_amount, COALESCE(p_notes, 'Recebimento parcial/total de conta a receber'), p_payment_method_id, p_account_receivable_id, v_user_id
    );

    SELECT to_jsonb(ar.*) INTO v_result FROM public.accounts_receivable ar WHERE ar.id = p_account_receivable_id;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.pay_account_receivable(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_account_receivable(UUID, UUID, NUMERIC, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.pay_account_payable(UUID, NUMERIC, UUID);
DROP FUNCTION IF EXISTS public.pay_account_payable(UUID, UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.pay_account_payable(UUID, UUID, NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION public.pay_account_payable(p_account_payable_id UUID, p_payment_method_id UUID, p_amount NUMERIC(12,2), p_notes TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_user_role TEXT;
    v_ap RECORD;
    v_pm RECORD;
    v_cr RECORD;
    v_new_paid NUMERIC(12,2);
    v_new_rem NUMERIC(12,2);
    v_status TEXT;
    v_tx_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.'; END IF;

    SELECT * INTO v_ap FROM public.accounts_payable WHERE accounts_payable.id = p_account_payable_id FOR UPDATE;
    IF v_ap.id IS NULL THEN RAISE EXCEPTION 'Erro: Conta a pagar não encontrada.'; END IF;
    v_org_id := v_ap.organization_id;

    SELECT role INTO v_user_role FROM public.organization_users WHERE organization_id = v_org_id AND user_id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL OR v_user_role != 'admin' THEN
        RAISE EXCEPTION 'Acesso negado: Somente administradores podem quitar contas a pagar.';
    END IF;

    IF v_ap.status = 'paid' OR v_ap.remaining_amount <= 0 THEN
        RAISE EXCEPTION 'Erro: Esta conta a pagar já está quitada.';
    END IF;

    IF p_amount <= 0 THEN RAISE EXCEPTION 'Erro: O valor do pagamento deve ser maior que 0.'; END IF;
    IF p_amount > v_ap.remaining_amount THEN
        RAISE EXCEPTION 'Erro: O valor pago (R$ %) supera o saldo a pagar (R$ %).', p_amount, v_ap.remaining_amount;
    END IF;

    SELECT * INTO v_pm FROM public.payment_methods WHERE payment_methods.id = p_payment_method_id AND payment_methods.organization_id = v_org_id AND payment_methods.is_active = TRUE;
    IF v_pm.id IS NULL THEN RAISE EXCEPTION 'Erro: Forma de pagamento inválida ou inativa.'; END IF;

    IF v_pm.type = 'cash' THEN
        SELECT * INTO v_cr FROM public.cash_registers WHERE organization_id = v_org_id AND status = 'open';
        IF v_cr.id IS NULL THEN
            RAISE EXCEPTION 'Erro: Para despesas pagas em dinheiro (espécie), o caixa físico precisa estar aberto.';
        END IF;
    END IF;

    v_new_paid := v_ap.paid_amount + p_amount;
    v_new_rem := v_ap.remaining_amount - p_amount;
    IF v_new_rem <= 0 THEN v_status := 'paid'; ELSE v_status := 'partial'; END IF;

    UPDATE public.accounts_payable SET
        paid_amount = v_new_paid,
        remaining_amount = v_new_rem,
        status = v_status,
        updated_at = NOW()
    WHERE accounts_payable.id = p_account_payable_id;

    INSERT INTO public.account_payable_payments (
        account_payable_id, organization_id, payment_method_id, amount, notes, created_by
    ) VALUES (
        p_account_payable_id, v_org_id, p_payment_method_id, p_amount, p_notes, v_user_id
    );

    IF v_pm.type = 'cash' AND v_cr.id IS NOT NULL THEN
        INSERT INTO public.cash_movements (
            organization_id, cash_register_id, type, amount, description, created_by
        ) VALUES (
            v_org_id, v_cr.id, 'expense', p_amount, 'Pagamento de Despesa: ' || v_ap.description, v_user_id
        );
    END IF;

    INSERT INTO public.financial_transactions (
        organization_id, type, amount, description, payment_method_id, category_id, account_payable_id, created_by
    ) VALUES (
        v_org_id, 'expense', p_amount, COALESCE(p_notes, 'Pagamento de conta a pagar: ' || v_ap.description), p_payment_method_id, v_ap.category_id, p_account_payable_id, v_user_id
    ) RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object('success', true, 'account_payable_id', p_account_payable_id, 'transaction_id', v_tx_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.pay_account_payable(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_account_payable(UUID, UUID, NUMERIC, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_commission_and_create_payable(p_commission_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_comm RECORD;
    v_prof RECORD;
    v_cat_id UUID;
    v_ap_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.'; END IF;

    SELECT * INTO v_comm FROM public.commissions WHERE commissions.id = p_commission_id FOR UPDATE;
    IF v_comm.id IS NULL THEN RAISE EXCEPTION 'Erro: Comissão não encontrada.'; END IF;

    SELECT role INTO v_user_role FROM public.organization_users WHERE organization_id = v_comm.organization_id AND user_id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL OR v_user_role != 'admin' THEN
        RAISE EXCEPTION 'Acesso negado: Somente administradores podem aprovar comissões.';
    END IF;

    IF v_comm.status != 'calculated' THEN
        RAISE EXCEPTION 'Erro: Esta comissão já foi aprovada ou quitada anteriormente.';
    END IF;

    SELECT * INTO v_prof FROM public.professionals WHERE professionals.id = v_comm.professional_id;
    SELECT financial_categories.id INTO v_cat_id FROM public.financial_categories WHERE financial_categories.organization_id = v_comm.organization_id AND financial_categories.name = 'Comissão de Profissionais' AND financial_categories.type = 'expense' LIMIT 1;

    INSERT INTO public.accounts_payable (
        organization_id, supplier_name, category_id, description, original_amount, paid_amount, remaining_amount, due_date, status
    ) VALUES (
        v_comm.organization_id, v_prof.name, v_cat_id, 'Comissão de Profissional - ' || v_prof.name || ' (' || v_comm.period_start || ' a ' || v_comm.period_end || ')',
        v_comm.commission_amount, 0.00, v_comm.commission_amount, CURRENT_DATE, 'pending'
    ) RETURNING id INTO v_ap_id;

    UPDATE public.commissions SET
        status = 'approved',
        approved_at = NOW(),
        approved_by = v_user_id,
        account_payable_id = v_ap_id,
        updated_at = NOW()
    WHERE commissions.id = p_commission_id;

    RETURN jsonb_build_object('success', true, 'commission_id', p_commission_id, 'account_payable_id', v_ap_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.approve_commission_and_create_payable(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_commission_and_create_payable(UUID) TO authenticated;

COMMIT;
