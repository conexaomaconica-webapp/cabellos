-- Migration 5: Triggers, RLS and RPCs for Sprint 2 (Atendimentos)

-- 1. TRIGGERS DE UPDATED_AT
DROP TRIGGER IF EXISTS trg_set_updated_at_payment_methods ON public.payment_methods;
CREATE TRIGGER trg_set_updated_at_payment_methods BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_appointments ON public.appointments;
CREATE TRIGGER trg_set_updated_at_appointments BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_appointment_services ON public.appointment_services;
CREATE TRIGGER trg_set_updated_at_appointment_services BEFORE UPDATE ON public.appointment_services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_appointment_payments ON public.appointment_payments;
CREATE TRIGGER trg_set_updated_at_appointment_payments BEFORE UPDATE ON public.appointment_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2. VALIDAÇÃO CROSS-TENANT EM TRIGGER
CREATE OR REPLACE FUNCTION public.validate_cross_tenant_sprint2()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'appointments' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.organization_id = NEW.organization_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant error: O cliente pertence a outra organização.';
        END IF;

        IF NEW.professional_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.professionals p WHERE p.id = NEW.professional_id AND p.organization_id = NEW.organization_id
            ) THEN
                RAISE EXCEPTION 'Cross-tenant error: O profissional pertence a outra organização.';
            END IF;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'appointment_services' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.appointments a WHERE a.id = NEW.appointment_id AND a.organization_id = NEW.organization_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant error: O atendimento pertence a outra organização.';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.organization_id = NEW.organization_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant error: O serviço pertence a outra organização.';
        END IF;

        IF NEW.professional_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.professionals p WHERE p.id = NEW.professional_id AND p.organization_id = NEW.organization_id
            ) THEN
                RAISE EXCEPTION 'Cross-tenant error: O profissional do serviço pertence a outra organização.';
            END IF;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'appointment_payments' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.appointments a WHERE a.id = NEW.appointment_id AND a.organization_id = NEW.organization_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant error: O atendimento pertence a outra organização.';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.payment_methods pm WHERE pm.id = NEW.payment_method_id AND pm.organization_id = NEW.organization_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant error: A forma de pagamento pertence a outra organização.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_val_cross_tenant_appointments ON public.appointments;
CREATE TRIGGER trg_val_cross_tenant_appointments BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint2();

DROP TRIGGER IF EXISTS trg_val_cross_tenant_app_services ON public.appointment_services;
CREATE TRIGGER trg_val_cross_tenant_app_services BEFORE INSERT OR UPDATE ON public.appointment_services FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint2();

DROP TRIGGER IF EXISTS trg_val_cross_tenant_app_payments ON public.appointment_payments;
CREATE TRIGGER trg_val_cross_tenant_app_payments BEFORE INSERT OR UPDATE ON public.appointment_payments FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint2();


-- 3. HABILITAR RLS E POLÍTICAS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RLS Select payment_methods" ON public.payment_methods;
CREATE POLICY "RLS Select payment_methods" ON public.payment_methods FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage payment_methods" ON public.payment_methods;
CREATE POLICY "RLS Manage payment_methods" ON public.payment_methods FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "RLS Select appointments" ON public.appointments;
CREATE POLICY "RLS Select appointments" ON public.appointments FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Insert appointments" ON public.appointments;
CREATE POLICY "RLS Insert appointments" ON public.appointments FOR INSERT WITH CHECK (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Update appointments" ON public.appointments;
CREATE POLICY "RLS Update appointments" ON public.appointments FOR UPDATE USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Select appointment_services" ON public.appointment_services;
CREATE POLICY "RLS Select appointment_services" ON public.appointment_services FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage appointment_services" ON public.appointment_services;
CREATE POLICY "RLS Manage appointment_services" ON public.appointment_services FOR ALL USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Select appointment_payments" ON public.appointment_payments;
CREATE POLICY "RLS Select appointment_payments" ON public.appointment_payments FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage appointment_payments" ON public.appointment_payments;
CREATE POLICY "RLS Manage appointment_payments" ON public.appointment_payments FOR ALL USING (public.user_belongs_to_org(organization_id));


-- 4. HELPER PRIVADO DE RECÁLCULO DAS MÉTRICAS DO CLIENTE (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.recalculate_client_metrics(p_client_id UUID, p_org_id UUID)
RETURNS VOID AS $$
DECLARE
    v_first TIMESTAMPTZ;
    v_last TIMESTAMPTZ;
    v_count INTEGER := 0;
    v_spent NUMERIC(12,2) := 0.00;
    v_avg NUMERIC(12,2) := 0.00;
BEGIN
    SELECT
        MIN(finished_at),
        MAX(finished_at),
        COUNT(*),
        COALESCE(SUM(total), 0.00)
    INTO v_first, v_last, v_count, v_spent
    FROM public.appointments
    WHERE client_id = p_client_id
      AND organization_id = p_org_id
      AND status = 'completed';

    IF v_count > 0 THEN
        v_avg := ROUND(v_spent / v_count, 2);
    END IF;

    UPDATE public.clients SET
        first_appointment_at = v_first,
        last_appointment_at = v_last,
        total_appointments = v_count,
        total_spent = v_spent,
        average_ticket = v_avg,
        updated_at = NOW()
    WHERE id = p_client_id AND organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.recalculate_client_metrics(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_client_metrics(UUID, UUID) FROM authenticated;


-- 5. RPC TRANSACIONAL ATÔMICA COMPLETE_APPOINTMENT
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
    v_pay_total NUMERIC(12,2) := 0.00;
    v_pay_status TEXT;
    v_item JSONB;
    v_payment JSONB;
    v_svc_price NUMERIC(12,2);
    v_svc_disc NUMERIC(12,2);
    v_svc_tot NUMERIC(12,2);
    v_svc_prof_id UUID;
    v_svc_id UUID;
    v_qty INTEGER;
    v_counts_ret BOOLEAN;
    v_finished_at TIMESTAMPTZ := NOW();
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    v_org_id := (p_data->>'organization_id')::UUID;
    v_client_id := (p_data->>'client_id')::UUID;
    v_main_prof_id := (p_data->>'professional_id')::UUID;

    -- 1. Validar Tenant e Papel do Usuário na Organização
    IF NOT public.user_belongs_to_org(v_org_id) THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não pertence a esta organização.';
    END IF;

    SELECT role INTO v_user_role
    FROM public.organization_users
    WHERE organization_id = v_org_id AND user_id = v_user_id AND is_active = TRUE;

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Perfil do usuário não encontrado nesta organização.';
    END IF;

    -- Se papel for professional, mapear profissionais.user_id = auth.uid()
    IF v_user_role = 'professional' THEN
        SELECT id INTO v_linked_prof_id
        FROM public.professionals
        WHERE user_id = v_user_id AND organization_id = v_org_id AND is_active = TRUE;

        IF v_linked_prof_id IS NULL THEN
            RAISE EXCEPTION 'Acesso negado: O usuário não possui cadastro de profissional ativo nesta organização.';
        END IF;

        -- O profissional só pode criar/alterar atendimento em seu próprio nome
        v_main_prof_id := v_linked_prof_id;
    END IF;

    -- 2. Validar que existe pelo menos 1 serviço no payload
    IF p_data->'services' IS NULL OR jsonb_array_length(p_data->'services') = 0 THEN
        RAISE EXCEPTION 'Erro: Informe ao menos 1 serviço para concluir o atendimento.';
    END IF;

    -- 3. Obter Timezone da Organização
    SELECT COALESCE(timezone, 'America/Sao_Paulo') INTO v_tz FROM public.organizations WHERE id = v_org_id;
    v_op_date := (v_finished_at AT TIME ZONE v_tz)::DATE;

    -- 4. Validar Cliente
    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = v_client_id AND organization_id = v_org_id AND is_active = TRUE) THEN
        RAISE EXCEPTION 'Erro: Cliente inválido ou inativo nesta organização.';
    END IF;

    -- 5. Validar Profissional Principal se informado
    IF v_main_prof_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.professionals WHERE id = v_main_prof_id AND organization_id = v_org_id AND is_active = TRUE) THEN
            RAISE EXCEPTION 'Erro: Profissional principal inválido ou inativo nesta organização.';
        END IF;
    END IF;

    -- 6. Validar Estado de Atendimento Existente (se atualização)
    IF p_data->>'appointment_id' IS NOT NULL THEN
        v_app_id := (p_data->>'appointment_id')::UUID;
        SELECT status INTO v_curr_status
        FROM public.appointments
        WHERE id = v_app_id AND organization_id = v_org_id;

        IF v_curr_status IS NULL THEN
            RAISE EXCEPTION 'Erro: Atendimento informado não foi encontrado nesta organização.';
        END IF;

        IF v_curr_status = 'completed' THEN
            RAISE EXCEPTION 'Erro: Este atendimento já foi concluído anteriormente.';
        END IF;

        IF v_curr_status = 'cancelled' THEN
            RAISE EXCEPTION 'Erro: Não é possível concluir um atendimento cancelado.';
        END IF;

        IF v_user_role = 'professional' AND EXISTS (
            SELECT 1 FROM public.appointments WHERE id = v_app_id AND professional_id != v_linked_prof_id
        ) THEN
            RAISE EXCEPTION 'Acesso negado: Você não pode alterar atendimento de outro profissional.';
        END IF;

        UPDATE public.appointments SET
            client_id = v_client_id,
            professional_id = v_main_prof_id,
            notes = p_data->>'notes',
            updated_at = NOW()
        WHERE id = v_app_id AND organization_id = v_org_id;
    ELSE
        INSERT INTO public.appointments (
            organization_id, client_id, professional_id, appointment_date, finished_at, status, notes, created_by
        ) VALUES (
            v_org_id, v_client_id, v_main_prof_id, v_op_date, v_finished_at, 'draft', p_data->>'notes', v_user_id
        ) RETURNING id INTO v_app_id;
    END IF;

    -- Limpar itens e pagamentos antigos (somente após todas as validações de estado passarem!)
    DELETE FROM public.appointment_services WHERE appointment_id = v_app_id AND organization_id = v_org_id;
    DELETE FROM public.appointment_payments WHERE appointment_id = v_app_id AND organization_id = v_org_id;

    -- 7. Processar e Validar Itens dos Serviços
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'services') LOOP
        v_svc_id := (v_item->>'service_id')::UUID;
        v_svc_prof_id := COALESCE((v_item->>'professional_id')::UUID, v_main_prof_id);
        v_qty := COALESCE((v_item->>'quantity')::INT, 1);
        v_svc_disc := COALESCE((v_item->>'discount')::NUMERIC, 0.00);

        IF v_qty <= 0 THEN RAISE EXCEPTION 'Erro: Quantidade do serviço deve ser maior que 0.'; END IF;
        IF v_svc_disc < 0 THEN RAISE EXCEPTION 'Erro: Desconto não pode ser negativo.'; END IF;

        IF v_user_role = 'professional' AND v_svc_prof_id != v_linked_prof_id THEN
            RAISE EXCEPTION 'Acesso negado: Você não pode registrar serviço em nome de outro profissional.';
        END IF;

        -- Validar Serviço no Tenant
        SELECT price, counts_for_return_frequency INTO v_svc_price, v_counts_ret
        FROM public.services WHERE id = v_svc_id AND organization_id = v_org_id AND is_active = TRUE;

        IF v_svc_price IS NULL THEN
            RAISE EXCEPTION 'Erro: Serviço inválido ou inativo nesta organização.';
        END IF;

        -- Validar Profissional Ativo do Item
        IF v_svc_prof_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.professionals WHERE id = v_svc_prof_id AND organization_id = v_org_id AND is_active = TRUE
            ) THEN
                RAISE EXCEPTION 'Erro: Profissional do serviço está inativo ou inválido.';
            END IF;

            -- Validar Vínculo Profissional x Serviço
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
        v_subtotal := v_subtotal + (v_qty * v_svc_price);
        v_discount := v_discount + v_svc_disc;

        INSERT INTO public.appointment_services (
            organization_id, appointment_id, service_id, professional_id, quantity, unit_price, discount, total, counts_for_return_frequency
        ) VALUES (
            v_org_id, v_app_id, v_svc_id, v_svc_prof_id, v_qty, v_svc_price, v_svc_disc, v_svc_tot, v_counts_ret
        );
    END LOOP;

    v_total := v_subtotal - v_discount;

    -- 8. Processar e Validar Pagamentos
    IF p_data->'payments' IS NOT NULL AND jsonb_array_length(p_data->'payments') > 0 THEN
        FOR v_payment IN SELECT * FROM jsonb_array_elements(p_data->'payments') LOOP
            IF (v_payment->>'amount')::NUMERIC <= 0 THEN RAISE EXCEPTION 'Erro: Valor de pagamento deve ser positivo.'; END IF;

            IF NOT EXISTS (
                SELECT 1 FROM public.payment_methods WHERE id = (v_payment->>'payment_method_id')::UUID AND organization_id = v_org_id AND is_active = TRUE
            ) THEN
                RAISE EXCEPTION 'Erro: Forma de pagamento inválida nesta organização.';
            END IF;

            v_pay_total := v_pay_total + (v_payment->>'amount')::NUMERIC;

            INSERT INTO public.appointment_payments (
                organization_id, appointment_id, payment_method_id, amount, installments, notes, paid_at
            ) VALUES (
                v_org_id, v_app_id, (v_payment->>'payment_method_id')::UUID, (v_payment->>'amount')::NUMERIC, COALESCE((v_payment->>'installments')::INT, 1), v_payment->>'notes', v_finished_at
            );
        END LOOP;
    END IF;

    -- Validação de Overpayment sem troco explicito
    IF v_pay_total > v_total THEN
        RAISE EXCEPTION 'Erro: A soma dos pagamentos (R$ %) supera o valor total do atendimento (R$ %).', v_pay_total, v_total;
    ELSIF v_pay_total = v_total THEN
        v_pay_status := 'paid';
    ELSIF v_pay_total > 0 THEN
        v_pay_status := 'partial';
    ELSE
        v_pay_status := 'pending';
    END IF;

    -- 9. Finalizar Atendimento
    UPDATE public.appointments SET
        subtotal = v_subtotal,
        discount = v_discount,
        total = v_total,
        payment_status = v_pay_status,
        status = 'completed',
        finished_at = v_finished_at,
        updated_at = NOW()
    WHERE id = v_app_id AND organization_id = v_org_id;

    -- 10. Recalcular Métricas do Cliente
    PERFORM public.recalculate_client_metrics(v_client_id, v_org_id);

    SELECT jsonb_build_object('id', v_app_id, 'status', 'completed', 'total', v_total) INTO v_result;
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE; -- Rollback Integral da Transação
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.complete_appointment FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_appointment TO authenticated;


-- 6. RPC TRANSACIONAL CANCEL_APPOINTMENT
CREATE OR REPLACE FUNCTION public.cancel_appointment(p_appointment_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_user_role TEXT;
    v_linked_prof_id UUID;
    v_client_id UUID;
    v_curr_status TEXT;
    v_app_prof_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    SELECT organization_id, client_id, status, professional_id INTO v_org_id, v_client_id, v_curr_status, v_app_prof_id
    FROM public.appointments WHERE id = p_appointment_id;

    IF v_org_id IS NULL THEN RAISE EXCEPTION 'Atendimento não encontrado.'; END IF;
    IF NOT public.user_belongs_to_org(v_org_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

    SELECT role INTO v_user_role
    FROM public.organization_users
    WHERE organization_id = v_org_id AND user_id = v_user_id AND is_active = TRUE;

    -- Professional não pode cancelar atendimentos já concluídos
    IF v_user_role = 'professional' THEN
        SELECT id INTO v_linked_prof_id FROM public.professionals WHERE user_id = v_user_id AND organization_id = v_org_id AND is_active = TRUE;
        IF v_app_prof_id != v_linked_prof_id THEN
            RAISE EXCEPTION 'Acesso negado: Profissional só pode cancelar os seus próprios atendimentos em aberto.';
        END IF;
        IF v_curr_status = 'completed' THEN
            RAISE EXCEPTION 'Acesso negado: Profissionais não têm permissão para cancelar atendimentos já concluídos.';
        END IF;
    END IF;

    IF v_curr_status = 'cancelled' THEN
        RAISE EXCEPTION 'Erro: Este atendimento já foi cancelado anteriormente.';
    END IF;

    -- Alterar status para cancelled
    UPDATE public.appointments SET
        status = 'cancelled',
        notes = CASE WHEN p_reason IS NOT NULL THEN COALESCE(notes || ' | Motivo cancelamento: ', '') || p_reason ELSE notes END,
        updated_at = NOW()
    WHERE id = p_appointment_id AND organization_id = v_org_id;

    -- Soft void dos pagamentos efetuados
    UPDATE public.appointment_payments SET
        voided_at = NOW(),
        updated_at = NOW()
    WHERE appointment_id = p_appointment_id AND organization_id = v_org_id AND voided_at IS NULL;

    -- Recalcular métricas do cliente
    PERFORM public.recalculate_client_metrics(v_client_id, v_org_id);

    RETURN jsonb_build_object('id', p_appointment_id, 'status', 'cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.cancel_appointment FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_appointment TO authenticated;


-- 7. BACKFILL E SEED DE FORMAS DE PAGAMENTO
INSERT INTO public.payment_methods (organization_id, name, type, sort_order)
SELECT id, 'Dinheiro', 'cash', 1 FROM public.organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO public.payment_methods (organization_id, name, type, sort_order)
SELECT id, 'PIX', 'pix', 2 FROM public.organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO public.payment_methods (organization_id, name, type, sort_order)
SELECT id, 'Cartão de Débito', 'debit_card', 3 FROM public.organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO public.payment_methods (organization_id, name, type, sort_order)
SELECT id, 'Cartão de Crédito', 'credit_card', 4 FROM public.organizations
ON CONFLICT (organization_id, name) DO NOTHING;
