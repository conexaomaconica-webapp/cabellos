-- Migration 11: Triggers, RLS and RPCs for Sprint 4 (Packages, Plans, Rules, Usages)

-- 1. TRIGGERS DE UPDATED_AT
DROP TRIGGER IF EXISTS trg_set_updated_at_packages ON public.packages;
CREATE TRIGGER trg_set_updated_at_packages BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_package_items ON public.package_items;
CREATE TRIGGER trg_set_updated_at_package_items BEFORE UPDATE ON public.package_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_package_rules ON public.package_rules;
CREATE TRIGGER trg_set_updated_at_package_rules BEFORE UPDATE ON public.package_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_client_packages ON public.client_packages;
CREATE TRIGGER trg_set_updated_at_client_packages BEFORE UPDATE ON public.client_packages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_client_package_items ON public.client_package_items;
CREATE TRIGGER trg_set_updated_at_client_package_items BEFORE UPDATE ON public.client_package_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_client_package_rules ON public.client_package_rules;
CREATE TRIGGER trg_set_updated_at_client_package_rules BEFORE UPDATE ON public.client_package_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_client_package_payments ON public.client_package_payments;
CREATE TRIGGER trg_set_updated_at_client_package_payments BEFORE UPDATE ON public.client_package_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2. VALIDAÇÃO CROSS-TENANT EM TRIGGER
CREATE OR REPLACE FUNCTION public.validate_cross_tenant_sprint4()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'package_items' THEN
        IF NOT EXISTS (SELECT 1 FROM public.packages p WHERE p.id = NEW.package_id AND p.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: O pacote pertence a outra organização.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: O serviço pertence a outra organização.';
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'package_rules' THEN
        IF NOT EXISTS (SELECT 1 FROM public.packages p WHERE p.id = NEW.package_id AND p.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: O pacote pertence a outra organização.';
        END IF;
        IF NEW.service_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.organization_id = NEW.organization_id) THEN
                RAISE EXCEPTION 'Cross-tenant error: O serviço da regra pertence a outra organização.';
            END IF;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'client_packages' THEN
        IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: O cliente pertence a outra organização.';
        END IF;
        IF NEW.package_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.packages p WHERE p.id = NEW.package_id AND p.organization_id = NEW.organization_id) THEN
                RAISE EXCEPTION 'Cross-tenant error: O pacote comercial pertence a outra organização.';
            END IF;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'client_package_items' THEN
        IF NOT EXISTS (SELECT 1 FROM public.client_packages cp WHERE cp.id = NEW.client_package_id AND cp.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: O pacote do cliente pertence a outra organização.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: O serviço pertence a outra organização.';
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'client_package_rules' THEN
        IF NOT EXISTS (SELECT 1 FROM public.client_packages cp WHERE cp.id = NEW.client_package_id AND cp.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: O pacote do cliente pertence a outra organização.';
        END IF;
        IF NEW.service_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.organization_id = NEW.organization_id) THEN
                RAISE EXCEPTION 'Cross-tenant error: O serviço da regra pertence a outra organização.';
            END IF;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'package_usages' THEN
        IF NOT EXISTS (SELECT 1 FROM public.client_packages cp WHERE cp.id = NEW.client_package_id AND cp.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: O pacote do cliente pertence a outra organização.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = NEW.appointment_id AND a.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: O atendimento pertence a outra organização.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: O serviço pertence a outra organização.';
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'client_package_payments' THEN
        IF NOT EXISTS (SELECT 1 FROM public.client_packages cp WHERE cp.id = NEW.client_package_id AND cp.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: O pacote do cliente pertence a outra organização.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.payment_methods pm WHERE pm.id = NEW.payment_method_id AND pm.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: A forma de pagamento pertence a outra organização.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_val_cross_tenant_pkg_items ON public.package_items;
CREATE TRIGGER trg_val_cross_tenant_pkg_items BEFORE INSERT OR UPDATE ON public.package_items FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint4();

DROP TRIGGER IF EXISTS trg_val_cross_tenant_pkg_rules ON public.package_rules;
CREATE TRIGGER trg_val_cross_tenant_pkg_rules BEFORE INSERT OR UPDATE ON public.package_rules FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint4();

DROP TRIGGER IF EXISTS trg_val_cross_tenant_client_pkgs ON public.client_packages;
CREATE TRIGGER trg_val_cross_tenant_client_pkgs BEFORE INSERT OR UPDATE ON public.client_packages FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint4();

DROP TRIGGER IF EXISTS trg_val_cross_tenant_client_pkg_items ON public.client_package_items;
CREATE TRIGGER trg_val_cross_tenant_client_pkg_items BEFORE INSERT OR UPDATE ON public.client_package_items FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint4();

DROP TRIGGER IF EXISTS trg_val_cross_tenant_client_pkg_rules ON public.client_package_rules;
CREATE TRIGGER trg_val_cross_tenant_client_pkg_rules BEFORE INSERT OR UPDATE ON public.client_package_rules FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint4();

DROP TRIGGER IF EXISTS trg_val_cross_tenant_pkg_usages ON public.package_usages;
CREATE TRIGGER trg_val_cross_tenant_pkg_usages BEFORE INSERT OR UPDATE ON public.package_usages FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint4();

DROP TRIGGER IF EXISTS trg_val_cross_tenant_client_pkg_payments ON public.client_package_payments;
CREATE TRIGGER trg_val_cross_tenant_client_pkg_payments BEFORE INSERT OR UPDATE ON public.client_package_payments FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint4();


-- 3. RLS E POLÍTICAS DE SEGURANÇA
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_package_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_package_payments ENABLE ROW LEVEL SECURITY;

-- PACKAGES
DROP POLICY IF EXISTS "RLS Select packages" ON public.packages;
CREATE POLICY "RLS Select packages" ON public.packages FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage packages" ON public.packages;
CREATE POLICY "RLS Manage packages" ON public.packages FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));

-- PACKAGE_ITEMS
DROP POLICY IF EXISTS "RLS Select package_items" ON public.package_items;
CREATE POLICY "RLS Select package_items" ON public.package_items FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage package_items" ON public.package_items;
CREATE POLICY "RLS Manage package_items" ON public.package_items FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));

-- PACKAGE_RULES
DROP POLICY IF EXISTS "RLS Select package_rules" ON public.package_rules;
CREATE POLICY "RLS Select package_rules" ON public.package_rules FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage package_rules" ON public.package_rules;
CREATE POLICY "RLS Manage package_rules" ON public.package_rules FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));

-- CLIENT_PACKAGES
DROP POLICY IF EXISTS "RLS Select client_packages" ON public.client_packages;
CREATE POLICY "RLS Select client_packages" ON public.client_packages FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage client_packages" ON public.client_packages;
CREATE POLICY "RLS Manage client_packages" ON public.client_packages FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin', 'receptionist']));

-- CLIENT_PACKAGE_ITEMS
DROP POLICY IF EXISTS "RLS Select client_package_items" ON public.client_package_items;
CREATE POLICY "RLS Select client_package_items" ON public.client_package_items FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage client_package_items" ON public.client_package_items;
CREATE POLICY "RLS Manage client_package_items" ON public.client_package_items FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin', 'receptionist']));

-- CLIENT_PACKAGE_RULES
DROP POLICY IF EXISTS "RLS Select client_package_rules" ON public.client_package_rules;
CREATE POLICY "RLS Select client_package_rules" ON public.client_package_rules FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage client_package_rules" ON public.client_package_rules;
CREATE POLICY "RLS Manage client_package_rules" ON public.client_package_rules FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin', 'receptionist']));

-- PACKAGE_USAGES
DROP POLICY IF EXISTS "RLS Select package_usages" ON public.package_usages;
CREATE POLICY "RLS Select package_usages" ON public.package_usages FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage package_usages" ON public.package_usages;
CREATE POLICY "RLS Manage package_usages" ON public.package_usages FOR ALL USING (public.user_belongs_to_org(organization_id));

-- CLIENT_PACKAGE_PAYMENTS
DROP POLICY IF EXISTS "RLS Select client_package_payments" ON public.client_package_payments;
CREATE POLICY "RLS Select client_package_payments" ON public.client_package_payments FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage client_package_payments" ON public.client_package_payments;
CREATE POLICY "RLS Manage client_package_payments" ON public.client_package_payments FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin', 'receptionist']));


-- 4. ROTINA OPERACIONAL DE ATUALIZAÇÃO DE STATUS DOS PACOTES
CREATE OR REPLACE FUNCTION public.update_client_package_statuses(p_org_id UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    -- 1. Marcar como EXPIRED pacotes ativos cuja data limite já passou
    UPDATE public.client_packages
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active'
      AND expires_at < NOW()
      AND (p_org_id IS NULL OR organization_id = p_org_id);

    -- 2. Marcar como COMPLETED pacotes de crédito cujos itens foram 100% consumidos (remaining_quantity = 0 para todos)
    UPDATE public.client_packages cp
    SET status = 'completed', updated_at = NOW()
    WHERE cp.status = 'active'
      AND (p_org_id IS NULL OR cp.organization_id = p_org_id)
      AND EXISTS (
          SELECT 1 FROM public.client_package_items cpi
          WHERE cpi.client_package_id = cp.id
            AND cpi.contracted_quantity IS NOT NULL
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.client_package_items cpi
          WHERE cpi.client_package_id = cp.id
            AND (cpi.remaining_quantity IS NULL OR cpi.remaining_quantity > 0)
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 5. RPC TRANSACIONAL DE VENDA DE PACOTE (SELL_CLIENT_PACKAGE)
CREATE OR REPLACE FUNCTION public.sell_client_package(p_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_user_role TEXT;
    v_client_id UUID;
    v_package_id UUID;
    v_starts_at TIMESTAMPTZ;
    v_expires_at TIMESTAMPTZ;
    v_discount NUMERIC(12,2) := 0.00;
    v_orig_price NUMERIC(12,2) := 0.00;
    v_sale_total NUMERIC(12,2) := 0.00;
    v_amt_paid NUMERIC(12,2) := 0.00;
    v_pay_status TEXT := 'pending';
    v_notes TEXT;
    v_renewed_from UUID;
    v_client_pkg_id UUID;
    v_pkg RECORD;
    v_item RECORD;
    v_rule RECORD;
    v_payment JSONB;
    v_pay_amt NUMERIC(12,2);
    v_pay_method_id UUID;
    v_installments INT;
    v_initial_qty INT;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    v_org_id := (p_data->>'organization_id')::UUID;
    v_client_id := (p_data->>'client_id')::UUID;
    v_package_id := (p_data->>'package_id')::UUID;

    -- Validar Tenant e Papel
    IF NOT public.user_belongs_to_org(v_org_id) THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não pertence a esta organização.';
    END IF;

    SELECT role INTO v_user_role
    FROM public.organization_users
    WHERE organization_id = v_org_id AND user_id = v_user_id AND is_active = TRUE;

    IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin', 'receptionist') THEN
        RAISE EXCEPTION 'Acesso negado: Somente proprietários, administradores e recepcionistas podem vender pacotes.';
    END IF;

    -- Validar Cliente e Pacote Comercial
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

    IF v_discount < 0 THEN RAISE EXCEPTION 'Erro: O desconto não pode ser negativo.'; END IF;
    IF v_discount > v_pkg.price THEN RAISE EXCEPTION 'Erro: O desconto não pode ser superior ao valor do pacote.'; END IF;

    v_orig_price := v_pkg.price;
    v_sale_total := v_orig_price - v_discount;

    -- Calcular Vigência conforme formato do pacote
    IF v_pkg.validity_type = 'months' THEN
        v_expires_at := v_starts_at + (v_pkg.validity_value || ' months')::INTERVAL;
    ELSIF v_pkg.validity_type = 'years' THEN
        v_expires_at := v_starts_at + (v_pkg.validity_value || ' years')::INTERVAL;
    ELSE
        v_expires_at := v_starts_at + (v_pkg.validity_days || ' days')::INTERVAL;
    END IF;

    -- Inserir Client Package
    INSERT INTO public.client_packages (
        organization_id, client_id, package_id, purchased_at, starts_at, expires_at,
        original_price, discount, amount_paid, payment_status, status,
        renewed_from_client_package_id, notes, created_by
    ) VALUES (
        v_org_id, v_client_id, v_package_id, NOW(), v_starts_at, v_expires_at,
        v_orig_price, v_discount, 0.00, 'pending', 'active',
        v_renewed_from, v_notes, v_user_id
    ) RETURNING id INTO v_client_pkg_id;

    -- Copiar Snapshot de Items (client_package_items)
    FOR v_item IN SELECT * FROM public.package_items WHERE package_id = v_package_id AND organization_id = v_org_id LOOP
        -- Verificar se existe regra de créditos associada ao serviço
        SELECT limit_quantity INTO v_initial_qty
        FROM public.package_rules
        WHERE package_id = v_package_id AND service_id = v_item.service_id AND rule_type = 'service_credit';

        INSERT INTO public.client_package_items (
            organization_id, client_package_id, service_id, contracted_quantity, used_quantity, remaining_quantity
        ) VALUES (
            v_org_id, v_client_pkg_id, v_item.service_id, v_initial_qty, 0, v_initial_qty
        );
    END LOOP;

    -- Copiar Snapshot de Rules (client_package_rules)
    FOR v_rule IN SELECT * FROM public.package_rules WHERE package_id = v_package_id AND organization_id = v_org_id LOOP
        INSERT INTO public.client_package_rules (
            organization_id, client_package_id, service_id, rule_type, limit_quantity, period_type, period_quantity, is_unlimited
        ) VALUES (
            v_org_id, v_client_pkg_id, v_rule.service_id, v_rule.rule_type, v_rule.limit_quantity, v_rule.period_type, v_rule.period_quantity, v_rule.is_unlimited
        );
    END LOOP;

    -- Processar Pagamentos Iniciais da Venda
    IF p_data->'payments' IS NOT NULL AND jsonb_array_length(p_data->'payments') > 0 THEN
        FOR v_payment IN SELECT * FROM jsonb_array_elements(p_data->'payments') LOOP
            v_pay_amt := (v_payment->>'amount')::NUMERIC;
            v_pay_method_id := (v_payment->>'payment_method_id')::UUID;
            v_installments := COALESCE((v_payment->>'installments')::INT, 1);

            IF v_pay_amt <= 0 THEN RAISE EXCEPTION 'Erro: Valor de pagamento do pacote deve ser maior que 0.'; END IF;

            IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE payment_methods.id = v_pay_method_id AND payment_methods.organization_id = v_org_id AND payment_methods.is_active = TRUE) THEN
                RAISE EXCEPTION 'Erro: Forma de pagamento inválida ou inativa nesta organização.';
            END IF;

            INSERT INTO public.client_package_payments (
                organization_id, client_package_id, payment_method_id, amount, installments, paid_at
            ) VALUES (
                v_org_id, v_client_pkg_id, v_pay_method_id, v_pay_amt, v_installments, NOW()
            );

            v_amt_paid := v_amt_paid + v_pay_amt;
        END LOOP;
    END IF;

    IF v_amt_paid > v_sale_total THEN
        RAISE EXCEPTION 'Erro: O valor total pago (R$ %) supera o valor líquido da venda (R$ %).', v_amt_paid, v_sale_total;
    END IF;

    IF v_amt_paid >= v_sale_total THEN
        v_pay_status := 'paid';
    ELSIF v_amt_paid > 0 THEN
        v_pay_status := 'partial';
    ELSE
        v_pay_status := 'pending';
    END IF;

    UPDATE public.client_packages SET
        amount_paid = v_amt_paid,
        payment_status = v_pay_status,
        updated_at = NOW()
    WHERE client_packages.id = v_client_pkg_id;

    SELECT jsonb_build_object(
        'id', cp.id,
        'organization_id', cp.organization_id,
        'client_id', cp.client_id,
        'package_id', cp.package_id,
        'starts_at', cp.starts_at,
        'expires_at', cp.expires_at,
        'original_price', cp.original_price,
        'discount', cp.discount,
        'amount_paid', cp.amount_paid,
        'payment_status', cp.payment_status,
        'status', cp.status
    ) INTO v_result
    FROM public.client_packages cp WHERE cp.id = v_client_pkg_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 6. RPC TRANSACIONAL DE CANCELAMENTO DE PACOTE (CANCEL_CLIENT_PACKAGE)
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
    IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Acesso negado: Somente proprietários e administradores podem cancelar pacotes vendidos.';
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


-- 7. RPC TRANSACIONAL DE RENOVAÇÃO DE PACOTE (RENEW_CLIENT_PACKAGE)
CREATE OR REPLACE FUNCTION public.renew_client_package(p_client_package_id UUID, p_payment_data JSONB DEFAULT '{}'::JSONB)
RETURNS JSONB AS $$
DECLARE
    v_cp RECORD;
    v_sell_payload JSONB;
BEGIN
    SELECT * INTO v_cp FROM public.client_packages WHERE client_packages.id = p_client_package_id;
    IF v_cp.id IS NULL THEN RAISE EXCEPTION 'Erro: Pacote do cliente não encontrado para renovação.'; END IF;

    IF v_cp.package_id IS NULL THEN
        RAISE EXCEPTION 'Erro: O pacote comercial original não está associado a este contrato.';
    END IF;

    v_sell_payload := jsonb_build_object(
        'organization_id', v_cp.organization_id,
        'client_id', v_cp.client_id,
        'package_id', v_cp.package_id,
        'starts_at', NOW(),
        'discount', COALESCE((p_payment_data->>'discount')::NUMERIC, 0.00),
        'notes', COALESCE(p_payment_data->>'notes', 'Renovação do pacote ' || p_client_package_id),
        'renewed_from_client_package_id', p_client_package_id,
        'payments', COALESCE(p_payment_data->'payments', '[]'::JSONB)
    );

    RETURN public.sell_client_package(v_sell_payload);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 8. ATUALIZAR COMPLETE_APPOINTMENT PARA INTEGRAR MONETÁRIO E PACOTES
CREATE OR REPLACE FUNCTION public.complete_appointment(p_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_user_role TEXT;
    v_linked_prof_id UUID;
    v_client_id UUID;
    v_main_prof_id UUID;
    v_app_id UUID;
    v_curr_status TEXT;
    v_tz TEXT;
    v_op_date DATE;
    v_subtotal NUMERIC(12,2) := 0.00;
    v_discount NUMERIC(12,2) := 0.00;
    v_total NUMERIC(12,2) := 0.00;
    v_pkg_covered_total NUMERIC(12,2) := 0.00;
    v_amount_due NUMERIC(12,2) := 0.00;
    v_pay_total NUMERIC(12,2) := 0.00;
    v_pay_status TEXT;
    v_allow_pending_pkg BOOLEAN := TRUE;
    
    v_item JSONB;
    v_payment JSONB;
    v_svc_price NUMERIC(12,2);
    v_svc_disc NUMERIC(12,2);
    v_svc_tot NUMERIC(12,2);
    v_item_pkg_covered NUMERIC(12,2);
    v_svc_prof_id UUID;
    v_svc_id UUID;
    v_qty INTEGER;
    v_counts_ret BOOLEAN;
    v_client_pkg_id UUID;
    v_app_svc_id UUID;
    v_finished_at TIMESTAMPTZ := NOW();
    v_result JSONB;

    -- Variáveis de validação de pacotes
    v_cp RECORD;
    v_cpi RECORD;
    v_cpr RECORD;
    v_period_start TIMESTAMPTZ;
    v_used_count INT := 0;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    v_org_id := (p_data->>'organization_id')::UUID;
    v_client_id := (p_data->>'client_id')::UUID;
    v_main_prof_id := (p_data->>'professional_id')::UUID;

    -- 1. Validar Tenant e Papel
    IF NOT public.user_belongs_to_org(v_org_id) THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não pertence a esta organização.';
    END IF;

    SELECT role INTO v_user_role
    FROM public.organization_users
    WHERE organization_id = v_org_id AND user_id = v_user_id AND is_active = TRUE;

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Perfil do usuário não encontrado nesta organização.';
    END IF;

    IF v_user_role = 'professional' THEN
        SELECT professionals.id INTO v_linked_prof_id
        FROM public.professionals
        WHERE professionals.user_id = v_user_id AND professionals.organization_id = v_org_id AND professionals.is_active = TRUE;

        IF v_linked_prof_id IS NULL THEN
            RAISE EXCEPTION 'Acesso negado: O usuário não possui cadastro de profissional ativo nesta organização.';
        END IF;

        v_main_prof_id := v_linked_prof_id;
    END IF;

    IF p_data->'services' IS NULL OR jsonb_array_length(p_data->'services') = 0 THEN
        RAISE EXCEPTION 'Erro: Informe ao menos 1 serviço para concluir o atendimento.';
    END IF;

    -- Obter Timezone e Configuração da Organização
    SELECT COALESCE(timezone, 'America/Sao_Paulo'), COALESCE(allow_package_usage_with_pending_balance, TRUE)
    INTO v_tz, v_allow_pending_pkg
    FROM public.organizations WHERE organizations.id = v_org_id;

    v_op_date := (v_finished_at AT TIME ZONE v_tz)::DATE;

    -- Validar Cliente
    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE clients.id = v_client_id AND clients.organization_id = v_org_id AND clients.is_active = TRUE) THEN
        RAISE EXCEPTION 'Erro: Cliente inválido ou inativo nesta organização.';
    END IF;

    -- Validar Profissional Principal se informado
    IF v_main_prof_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.professionals WHERE professionals.id = v_main_prof_id AND professionals.organization_id = v_org_id AND professionals.is_active = TRUE) THEN
            RAISE EXCEPTION 'Erro: Profissional principal inválido ou inativo nesta organização.';
        END IF;
    END IF;

    -- Validar Estado de Atendimento Existente
    IF p_data->>'appointment_id' IS NOT NULL THEN
        v_app_id := (p_data->>'appointment_id')::UUID;
        SELECT status INTO v_curr_status FROM public.appointments WHERE appointments.id = v_app_id AND appointments.organization_id = v_org_id;

        IF v_curr_status IS NULL THEN RAISE EXCEPTION 'Erro: Atendimento informado não foi encontrado nesta organização.'; END IF;
        IF v_curr_status = 'completed' THEN RAISE EXCEPTION 'Erro: Este atendimento já foi concluído anteriormente.'; END IF;
        IF v_curr_status = 'cancelled' THEN RAISE EXCEPTION 'Erro: Não é possível concluir um atendimento cancelado.'; END IF;

        IF v_user_role = 'professional' AND EXISTS (
            SELECT 1 FROM public.appointments WHERE appointments.id = v_app_id AND appointments.professional_id != v_linked_prof_id
        ) THEN
            RAISE EXCEPTION 'Acesso negado: Você não pode alterar atendimento de outro profissional.';
        END IF;

        UPDATE public.appointments SET
            client_id = v_client_id,
            professional_id = v_main_prof_id,
            notes = p_data->>'notes',
            updated_at = NOW()
        WHERE appointments.id = v_app_id AND organization_id = v_org_id;
    ELSE
        INSERT INTO public.appointments (
            organization_id, client_id, professional_id, appointment_date, finished_at, status, notes, created_by
        ) VALUES (
            v_org_id, v_client_id, v_main_prof_id, v_op_date, v_finished_at, 'draft', p_data->>'notes', v_user_id
        ) RETURNING id INTO v_app_id;
    END IF;

    -- Limpar itens antigos se for atualização
    DELETE FROM public.package_usages WHERE appointment_id = v_app_id AND organization_id = v_org_id;
    DELETE FROM public.appointment_services WHERE appointment_id = v_app_id AND organization_id = v_org_id;
    DELETE FROM public.appointment_payments WHERE appointment_id = v_app_id AND organization_id = v_org_id;

    -- 7. Processar Serviços e Consumos de Pacote
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'services') LOOP
        v_svc_id := (v_item->>'service_id')::UUID;
        v_svc_prof_id := COALESCE((v_item->>'professional_id')::UUID, v_main_prof_id);
        v_qty := COALESCE((v_item->>'quantity')::INT, 1);
        v_svc_disc := COALESCE((v_item->>'discount')::NUMERIC, 0.00);
        v_client_pkg_id := (v_item->>'client_package_id')::UUID;
        v_item_pkg_covered := 0.00;

        IF v_qty <= 0 THEN RAISE EXCEPTION 'Erro: Quantidade do serviço deve ser maior que 0.'; END IF;
        IF v_svc_disc < 0 THEN RAISE EXCEPTION 'Erro: Desconto não pode ser negativo.'; END IF;

        IF v_user_role = 'professional' AND v_svc_prof_id != v_linked_prof_id THEN
            RAISE EXCEPTION 'Acesso negado: Você não pode registrar serviço em nome de outro profissional.';
        END IF;

        SELECT price, counts_for_return_frequency INTO v_svc_price, v_counts_ret
        FROM public.services WHERE services.id = v_svc_id AND services.organization_id = v_org_id AND services.is_active = TRUE;

        IF v_svc_price IS NULL THEN RAISE EXCEPTION 'Erro: Serviço inválido ou inativo nesta organização.'; END IF;

        IF v_svc_prof_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.professionals WHERE professionals.id = v_svc_prof_id AND professionals.organization_id = v_org_id AND professionals.is_active = TRUE) THEN
                RAISE EXCEPTION 'Erro: Profissional do serviço está inativo ou inválido.';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM public.professional_services
                WHERE professional_id = v_svc_prof_id AND service_id = v_svc_id AND organization_id = v_org_id AND is_active = TRUE
            ) THEN
                RAISE EXCEPTION 'Erro: O profissional informado não possui vínculo ativo com este serviço.';
            END IF;

            SELECT COALESCE(custom_price, v_svc_price) INTO v_svc_price
            FROM public.professional_services WHERE professional_id = v_svc_prof_id AND service_id = v_svc_id AND organization_id = v_org_id;
        END IF;

        IF v_user_role = 'professional' AND v_svc_disc > 0 THEN
            RAISE EXCEPTION 'Acesso negado: Profissionais não têm permissão para conceder descontos administrativos.';
        END IF;

        IF v_svc_disc > (v_qty * v_svc_price) THEN
            RAISE EXCEPTION 'Erro: Desconto do item não pode ser superior ao valor total do serviço.';
        END IF;

        v_svc_tot := (v_qty * v_svc_price) - v_svc_disc;

        -- SE HOUVER PACOTE COBRINDO ESTE SERVIÇO (PROCESSAR REGRAS COM LOCK TRANSACIONAL)
        IF v_client_pkg_id IS NOT NULL THEN
            -- Lock na tabela do pacote do cliente
            SELECT * INTO v_cp FROM public.client_packages
            WHERE client_packages.id = v_client_pkg_id AND client_packages.client_id = v_client_id AND client_packages.organization_id = v_org_id
            FOR UPDATE;

            IF v_cp.id IS NULL THEN RAISE EXCEPTION 'Erro: Pacote do cliente não encontrado.'; END IF;
            IF v_cp.status != 'active' THEN RAISE EXCEPTION 'Erro: O pacote selecionado não está ativo (status: %).', v_cp.status; END IF;
            IF v_cp.expires_at < NOW() THEN RAISE EXCEPTION 'Erro: O pacote selecionado já venceu em %.', v_cp.expires_at; END IF;

            IF NOT v_allow_pending_pkg AND v_cp.payment_status != 'paid' THEN
                RAISE EXCEPTION 'Erro: Este pacote possui pendência financeira e a organização não permite utilização com saldo pendente.';
            END IF;

            -- Buscar regras aplicáveis para este serviço com FOR UPDATE
            SELECT * INTO v_cpr FROM public.client_package_rules
            WHERE client_package_id = v_client_pkg_id AND (service_id = v_svc_id OR service_id IS NULL)
            ORDER BY service_id DESC NULLS LAST
            LIMIT 1
            FOR UPDATE;

            -- Buscar item do contrato para créditos com FOR UPDATE
            SELECT * INTO v_cpi FROM public.client_package_items
            WHERE client_package_id = v_client_pkg_id AND service_id = v_svc_id
            FOR UPDATE;

            -- Validação por Tipo de Regra
            IF v_cpr.rule_type = 'service_credit' THEN
                IF v_cpi.id IS NULL OR v_cpi.remaining_quantity < v_qty THEN
                    RAISE EXCEPTION 'Erro: Saldo de créditos insuficiente para o serviço no pacote. Restante: %, Solicitado: %', COALESCE(v_cpi.remaining_quantity, 0), v_qty;
                END IF;

                -- Abater Saldo nos Créditos
                UPDATE public.client_package_items SET
                    used_quantity = used_quantity + v_qty,
                    remaining_quantity = remaining_quantity - v_qty,
                    updated_at = NOW()
                WHERE client_package_items.id = v_cpi.id;

            ELSIF v_cpr.rule_type = 'period_limit' THEN
                -- Definir o início do período calendário (week/month/year)
                IF v_cpr.period_type = 'week' THEN
                    v_period_start := date_trunc('week', NOW() AT TIME ZONE v_tz);
                ELSIF v_cpr.period_type = 'year' THEN
                    v_period_start := date_trunc('year', NOW() AT TIME ZONE v_tz);
                ELSE
                    v_period_start := date_trunc('month', NOW() AT TIME ZONE v_tz);
                END IF;

                SELECT COALESCE(SUM(quantity), 0) INTO v_used_count
                FROM public.package_usages
                WHERE client_package_id = v_client_pkg_id
                  AND service_id = v_svc_id
                  AND used_at >= v_period_start
                  AND voided_at IS NULL;

                IF (v_used_count + v_qty) > v_cpr.limit_quantity THEN
                    RAISE EXCEPTION 'Erro: Limite do período (% utilizações/% ) atingido para este serviço no plano.', v_used_count, v_cpr.limit_quantity;
                END IF;

            ELSIF v_cpr.rule_type = 'total_limit' THEN
                IF v_cpr.period_type = 'week' THEN
                    v_period_start := date_trunc('week', NOW() AT TIME ZONE v_tz);
                ELSIF v_cpr.period_type = 'year' THEN
                    v_period_start := date_trunc('year', NOW() AT TIME ZONE v_tz);
                ELSE
                    v_period_start := date_trunc('month', NOW() AT TIME ZONE v_tz);
                END IF;

                SELECT COALESCE(SUM(quantity), 0) INTO v_used_count
                FROM public.package_usages
                WHERE client_package_id = v_client_pkg_id
                  AND used_at >= v_period_start
                  AND voided_at IS NULL;

                IF (v_used_count + v_qty) > v_cpr.limit_quantity THEN
                    RAISE EXCEPTION 'Erro: Limite global do plano no período (% utilizações/%) atingido.', v_used_count, v_cpr.limit_quantity;
                END IF;
            END IF;

            -- O serviço é 100% coberto pelo pacote
            v_item_pkg_covered := v_svc_tot;
            v_pkg_covered_total := v_pkg_covered_total + v_item_pkg_covered;
        END IF;

        v_subtotal := v_subtotal + (v_qty * v_svc_price);
        v_discount := v_discount + v_svc_disc;

        INSERT INTO public.appointment_services (
            organization_id, appointment_id, service_id, professional_id, quantity, unit_price, discount, total, package_covered_amount, client_package_id, counts_for_return_frequency
        ) VALUES (
            v_org_id, v_app_id, v_svc_id, v_svc_prof_id, v_qty, v_svc_price, v_svc_disc, v_svc_tot, v_item_pkg_covered, v_client_pkg_id, v_counts_ret
        ) RETURNING id INTO v_app_svc_id;

        -- Registrar Auditoria de Uso (package_usages) se houver pacote
        IF v_client_pkg_id IS NOT NULL THEN
            INSERT INTO public.package_usages (
                organization_id, client_package_id, client_package_item_id, client_package_rule_id,
                appointment_id, appointment_service_id, service_id, professional_id, quantity, used_at, created_by
            ) VALUES (
                v_org_id, v_client_pkg_id, v_cpi.id, v_cpr.id,
                v_app_id, v_app_svc_id, v_svc_id, v_svc_prof_id, v_qty, NOW(), v_user_id
            );

            -- Se for pacote de créditos e todos os itens zeraram, marcar COMPLETED
            IF v_cpr.rule_type = 'service_credit' THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.client_package_items
                    WHERE client_package_id = v_client_pkg_id AND (remaining_quantity IS NULL OR remaining_quantity > 0)
                ) THEN
                    UPDATE public.client_packages SET status = 'completed', updated_at = NOW() WHERE client_packages.id = v_client_pkg_id;
                END IF;
            END IF;
        END IF;
    END LOOP;

    v_total := v_subtotal - v_discount;
    v_amount_due := GREATEST(0.00, v_total - v_pkg_covered_total);

    -- 8. Processar Pagamentos Financeiros (Validar estritamente contra amount_due)
    IF p_data->'payments' IS NOT NULL AND jsonb_array_length(p_data->'payments') > 0 THEN
        FOR v_payment IN SELECT * FROM jsonb_array_elements(p_data->'payments') LOOP
            IF (v_payment->>'amount')::NUMERIC <= 0 THEN RAISE EXCEPTION 'Erro: Valor de pagamento deve ser positivo.'; END IF;

            IF NOT EXISTS (
                SELECT 1 FROM public.payment_methods WHERE payment_methods.id = (v_payment->>'payment_method_id')::UUID AND payment_methods.organization_id = v_org_id AND payment_methods.is_active = TRUE
            ) THEN
                RAISE EXCEPTION 'Erro: Forma de pagamento inválida ou inativa nesta organização.';
            END IF;

            INSERT INTO public.appointment_payments (
                organization_id, appointment_id, payment_method_id, amount, installments, notes, paid_at
            ) VALUES (
                v_org_id, v_app_id, (v_payment->>'payment_method_id')::UUID, (v_payment->>'amount')::NUMERIC, COALESCE((v_payment->>'installments')::INT, 1), v_payment->>'notes', NOW()
            );

            v_pay_total := v_pay_total + (v_payment->>'amount')::NUMERIC;
        END LOOP;
    END IF;

    IF v_pay_total > v_amount_due THEN
        RAISE EXCEPTION 'Erro: Pagamento (R$ %) maior do que o valor devido (R$ %).', v_pay_total, v_amount_due;
    END IF;

    IF v_pay_total >= v_amount_due THEN
        v_pay_status := 'paid';
    ELSIF v_pay_total > 0 THEN
        v_pay_status := 'partial';
    ELSE
        v_pay_status := 'pending';
    END IF;

    -- 9. Concluir Atendimento com Métricas Monetárias
    UPDATE public.appointments SET
        subtotal = v_subtotal,
        discount = v_discount,
        total = v_total,
        package_covered_amount = v_pkg_covered_total,
        amount_due = v_amount_due,
        payment_status = v_pay_status,
        status = 'completed',
        finished_at = v_finished_at,
        updated_at = NOW()
    WHERE appointments.id = v_app_id AND organization_id = v_org_id;

    -- 10. Recalcular Métricas do Cliente (Apenas receita efetiva recebida financeiramente)
    PERFORM public.recalculate_client_metrics(v_client_id, v_org_id);

    -- 11. Recalcular Frequência de Retorno por Serviço para os serviços elegíveis
    FOR v_svc_id IN SELECT DISTINCT service_id FROM public.appointment_services WHERE appointment_id = v_app_id AND counts_for_return_frequency = TRUE LOOP
        PERFORM public.recalculate_client_service_frequency(v_client_id, v_svc_id, v_org_id);
    END LOOP;

    SELECT jsonb_build_object(
        'id', a.id,
        'organization_id', a.organization_id,
        'client_id', a.client_id,
        'subtotal', a.subtotal,
        'discount', a.discount,
        'total', a.total,
        'package_covered_amount', a.package_covered_amount,
        'amount_due', a.amount_due,
        'payment_status', a.payment_status,
        'status', a.status
    ) INTO v_result
    FROM public.appointments a WHERE a.id = v_app_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 9. ATUALIZAR CANCEL_APPOINTMENT PARA RESTAURAR USOS DE PACOTE
CREATE OR REPLACE FUNCTION public.cancel_appointment(p_appointment_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_user_role TEXT;
    v_app RECORD;
    v_usage RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.'; END IF;

    SELECT * INTO v_app FROM public.appointments WHERE appointments.id = p_appointment_id;
    IF v_app.id IS NULL THEN RAISE EXCEPTION 'Erro: Atendimento não encontrado.'; END IF;

    v_org_id := v_app.organization_id;

    SELECT role INTO v_user_role FROM public.organization_users WHERE organization_id = v_org_id AND user_id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL THEN RAISE EXCEPTION 'Acesso negado: Usuário não pertence a esta organização.'; END IF;

    IF v_user_role = 'professional' AND v_app.professional_id IS DISTINCT FROM (
        SELECT professionals.id FROM public.professionals WHERE professionals.user_id = v_user_id AND professionals.organization_id = v_org_id AND professionals.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Acesso negado: Profissionais só podem cancelar seus próprios atendimentos.';
    END IF;

    IF v_app.status = 'cancelled' THEN RAISE EXCEPTION 'Erro: Atendimento já está cancelado.'; END IF;

    -- Anular Usos de Pacote Associados (package_usages.voided_at) e Devolver Créditos se aplicável
    FOR v_usage IN SELECT * FROM public.package_usages WHERE appointment_id = p_appointment_id AND voided_at IS NULL LOOP
        UPDATE public.package_usages SET voided_at = NOW() WHERE package_usages.id = v_usage.id;

        IF v_usage.client_package_item_id IS NOT NULL THEN
            UPDATE public.client_package_items SET
                used_quantity = GREATEST(0, used_quantity - v_usage.quantity),
                remaining_quantity = remaining_quantity + v_usage.quantity,
                updated_at = NOW()
            WHERE client_package_items.id = v_usage.client_package_item_id;

            -- Restaurar status do pacote para active se estava completed
            UPDATE public.client_packages SET status = 'active', updated_at = NOW()
            WHERE client_packages.id = v_usage.client_package_id AND client_packages.status = 'completed';
        END IF;
    END LOOP;

    -- Anular Pagamentos Financeiros
    UPDATE public.appointment_payments SET voided_at = NOW() WHERE appointment_id = p_appointment_id;

    -- Atualizar Estado do Atendimento
    UPDATE public.appointments SET
        status = 'cancelled',
        notes = COALESCE(notes || ' | Cancelado: ' || p_reason, 'Cancelado: ' || p_reason),
        updated_at = NOW()
    WHERE appointments.id = p_appointment_id;

    -- Recalcular métricas do cliente
    PERFORM public.recalculate_client_metrics(v_app.client_id, v_org_id);

    RETURN jsonb_build_object('success', true, 'id', p_appointment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
