-- Migration 8: Triggers, Functions, RLS & Seed for Sprint 3 (Retornos e Engajamento)

-- 1. TRIGGERS DE UPDATED_AT
DROP TRIGGER IF EXISTS trg_set_updated_at_client_service_freq ON public.client_service_frequencies;
CREATE TRIGGER trg_set_updated_at_client_service_freq BEFORE UPDATE ON public.client_service_frequencies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_return_alerts ON public.return_alerts;
CREATE TRIGGER trg_set_updated_at_return_alerts BEFORE UPDATE ON public.return_alerts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_message_templates ON public.message_templates;
CREATE TRIGGER trg_set_updated_at_message_templates BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2. HABILITAR RLS E POLÍTICAS DE SEGURANÇA
ALTER TABLE public.client_service_frequencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

-- Policies para client_service_frequencies
DROP POLICY IF EXISTS "RLS Select client_service_frequencies" ON public.client_service_frequencies;
CREATE POLICY "RLS Select client_service_frequencies" ON public.client_service_frequencies FOR SELECT USING (
    public.user_has_org_role(organization_id, ARRAY['owner', 'admin', 'receptionist'])
    OR (
        public.user_has_org_role(organization_id, ARRAY['professional'])
        AND last_professional_id IN (
            SELECT id FROM public.professionals WHERE user_id = auth.uid() AND organization_id = client_service_frequencies.organization_id AND is_active = TRUE
        )
    )
);

DROP POLICY IF EXISTS "RLS Manage client_service_frequencies" ON public.client_service_frequencies;
CREATE POLICY "RLS Manage client_service_frequencies" ON public.client_service_frequencies FOR ALL USING (
    public.user_has_org_role(organization_id, ARRAY['owner', 'admin', 'receptionist'])
);

-- Policies para return_alerts
DROP POLICY IF EXISTS "RLS Select return_alerts" ON public.return_alerts;
CREATE POLICY "RLS Select return_alerts" ON public.return_alerts FOR SELECT USING (
    public.user_has_org_role(organization_id, ARRAY['owner', 'admin', 'receptionist'])
    OR (
        public.user_has_org_role(organization_id, ARRAY['professional'])
        AND client_service_frequency_id IN (
            SELECT id FROM public.client_service_frequencies
            WHERE organization_id = return_alerts.organization_id
              AND last_professional_id IN (
                  SELECT id FROM public.professionals WHERE user_id = auth.uid() AND organization_id = return_alerts.organization_id AND is_active = TRUE
              )
        )
    )
);

DROP POLICY IF EXISTS "RLS Manage return_alerts" ON public.return_alerts;
CREATE POLICY "RLS Manage return_alerts" ON public.return_alerts FOR ALL USING (
    public.user_belongs_to_org(organization_id)
);

-- Policies para message_templates
DROP POLICY IF EXISTS "RLS Select message_templates" ON public.message_templates;
CREATE POLICY "RLS Select message_templates" ON public.message_templates FOR SELECT USING (
    public.user_belongs_to_org(organization_id)
);

DROP POLICY IF EXISTS "RLS Manage message_templates" ON public.message_templates;
CREATE POLICY "RLS Manage message_templates" ON public.message_templates FOR ALL USING (
    public.user_has_org_role(organization_id, ARRAY['owner', 'admin'])
);

-- Policies para client_contacts
DROP POLICY IF EXISTS "RLS Select client_contacts" ON public.client_contacts;
CREATE POLICY "RLS Select client_contacts" ON public.client_contacts FOR SELECT USING (
    public.user_belongs_to_org(organization_id)
);

DROP POLICY IF EXISTS "RLS Insert client_contacts" ON public.client_contacts;
CREATE POLICY "RLS Insert client_contacts" ON public.client_contacts FOR INSERT WITH CHECK (
    public.user_belongs_to_org(organization_id)
);


-- 3. FUNÇÃO DE ATUALIZAÇÃO IDEMPOTENTE DOS STATUS DOS ALERTAS
CREATE OR REPLACE FUNCTION public.update_return_alert_statuses(p_org_id UUID)
RETURNS VOID AS $$
DECLARE
    v_tz TEXT := 'America/Sao_Paulo';
    v_today DATE;
    v_lead INT := 7;
BEGIN
    SELECT COALESCE(timezone, 'America/Sao_Paulo'), COALESCE(alert_lead_days, 7)
    INTO v_tz, v_lead
    FROM public.organizations WHERE id = p_org_id;

    v_today := (NOW() AT TIME ZONE v_tz)::DATE;

    -- 1. Reativar alertas snoozed cuja data expirou
    UPDATE public.return_alerts SET
        status = CASE WHEN expected_return_at < v_today THEN 'overdue' ELSE 'due' END,
        days_overdue = GREATEST(0, (v_today - expected_return_at)),
        snoozed_until = NULL,
        updated_at = NOW()
    WHERE organization_id = p_org_id
      AND status = 'snoozed'
      AND snoozed_until IS NOT NULL
      AND snoozed_until <= v_today;

    -- 2. Atualizar alertas upcoming para due ou overdue
    UPDATE public.return_alerts SET
        status = CASE WHEN expected_return_at = v_today THEN 'due' ELSE 'overdue' END,
        days_overdue = GREATEST(0, (v_today - expected_return_at)),
        updated_at = NOW()
    WHERE organization_id = p_org_id
      AND status = 'upcoming'
      AND expected_return_at <= v_today;

    -- 3. Atualizar alertas due para overdue
    UPDATE public.return_alerts SET
        status = 'overdue',
        days_overdue = (v_today - expected_return_at),
        updated_at = NOW()
    WHERE organization_id = p_org_id
      AND status = 'due'
      AND expected_return_at < v_today;

    -- 4. Atualizar contagem de dias em atraso para overdue existentes
    UPDATE public.return_alerts SET
        days_overdue = (v_today - expected_return_at),
        updated_at = NOW()
    WHERE organization_id = p_org_id
      AND status = 'overdue';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 4. FUNÇÃO TRANSACIONAL DE RECÁLCULO DE FREQUÊNCIA POR SERVIÇO
CREATE OR REPLACE FUNCTION public.recalculate_client_service_frequency(
    p_client_id UUID,
    p_service_id UUID,
    p_org_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_visit_count INT := 0;
    v_first_at TIMESTAMPTZ;
    v_last_at TIMESTAMPTZ;
    v_last_prof_id UUID;
    v_manual_days INT;
    v_service_default_days INT;
    v_global_default_days INT := 20;
    v_min_visits INT := 3;
    v_auto_create_alerts BOOLEAN := TRUE;
    v_lead_days INT := 7;
    v_tz TEXT := 'America/Sao_Paulo';
    
    v_avg_days NUMERIC(6,1) := NULL;
    v_effective_days INT := 20;
    v_mode TEXT := 'global_default';
    v_confidence TEXT := 'low';
    v_next_return DATE;
    v_today DATE;
    v_freq_id UUID;
    v_alert_status TEXT;

    v_rec RECORD;
    v_prev_date DATE := NULL;
    v_diff_sum INT := 0;
    v_diff_count INT := 0;
BEGIN
    -- Obter configurações da organização
    SELECT 
        COALESCE(default_return_interval_days, 20),
        COALESCE(minimum_visits_for_average, 3),
        COALESCE(auto_create_alerts, TRUE),
        COALESCE(alert_lead_days, 7),
        COALESCE(timezone, 'America/Sao_Paulo')
    INTO v_global_default_days, v_min_visits, v_auto_create_alerts, v_lead_days, v_tz
    FROM public.organizations WHERE id = p_org_id;

    v_today := (NOW() AT TIME ZONE v_tz)::DATE;

    -- Obter intervalo padrão do serviço
    SELECT default_return_interval_days INTO v_service_default_days
    FROM public.services WHERE id = p_service_id AND organization_id = p_org_id;

    -- Obter manual_interval_days existente se houver
    SELECT manual_interval_days INTO v_manual_days
    FROM public.client_service_frequencies
    WHERE organization_id = p_org_id AND client_id = p_client_id AND service_id = p_service_id;

    -- 1. Contar visitas distintas concluídas para esse serviço
    SELECT COUNT(DISTINCT a.id), MIN(a.finished_at), MAX(a.finished_at)
    INTO v_visit_count, v_first_at, v_last_at
    FROM public.appointments a
    JOIN public.appointment_services aps ON aps.appointment_id = a.id
    WHERE a.client_id = p_client_id
      AND aps.service_id = p_service_id
      AND a.organization_id = p_org_id
      AND a.status = 'completed'
      AND aps.counts_for_return_frequency = TRUE;

    IF v_visit_count = 0 THEN
        -- Sem visitas concluídas ativas
        RETURN;
    END IF;

    -- 2. Identificar o last_professional_id do serviço mais recente
    SELECT COALESCE(aps.professional_id, a.professional_id) INTO v_last_prof_id
    FROM public.appointments a
    JOIN public.appointment_services aps ON aps.appointment_id = a.id
    WHERE a.client_id = p_client_id
      AND aps.service_id = p_service_id
      AND a.organization_id = p_org_id
      AND a.status = 'completed'
      AND aps.counts_for_return_frequency = TRUE
    ORDER BY a.finished_at DESC, a.created_at DESC
    LIMIT 1;

    -- 3. Calcular média dos intervalos em dias de visitas distintas consecutivas
    FOR v_rec IN 
        SELECT (a.finished_at AT TIME ZONE v_tz)::DATE AS visit_date
        FROM public.appointments a
        JOIN public.appointment_services aps ON aps.appointment_id = a.id
        WHERE a.client_id = p_client_id
          AND aps.service_id = p_service_id
          AND a.organization_id = p_org_id
          AND a.status = 'completed'
          AND aps.counts_for_return_frequency = TRUE
        GROUP BY (a.finished_at AT TIME ZONE v_tz)::DATE
        ORDER BY visit_date ASC
    LOOP
        IF v_prev_date IS NOT NULL THEN
            v_diff_sum := v_diff_sum + (v_rec.visit_date - v_prev_date);
            v_diff_count := v_diff_count + 1;
        END IF;
        v_prev_date := v_rec.visit_date;
    END LOOP;

    IF v_diff_count > 0 THEN
        v_avg_days := ROUND(v_diff_sum::NUMERIC / v_diff_count::NUMERIC, 1);
    END IF;

    -- 4. Avaliar regras de prioridade para effective_interval_days
    IF v_manual_days IS NOT NULL AND v_manual_days > 0 THEN
        v_effective_days := v_manual_days;
        v_mode := 'manual';
        v_confidence := 'high';
    ELSIF v_visit_count >= v_min_visits AND v_avg_days IS NOT NULL AND v_avg_days > 0 THEN
        v_effective_days := ROUND(v_avg_days)::INT;
        v_mode := 'automatic';
        IF v_visit_count >= 5 THEN
            v_confidence := 'high';
        ELSIF v_visit_count >= 3 THEN
            v_confidence := 'medium';
        ELSE
            v_confidence := 'low';
        END IF;
    ELSIF v_service_default_days IS NOT NULL AND v_service_default_days > 0 THEN
        v_effective_days := v_service_default_days;
        v_mode := 'service_default';
        v_confidence := 'low';
    ELSE
        v_effective_days := v_global_default_days;
        v_mode := 'global_default';
        v_confidence := 'low';
    END IF;

    -- 5. Calcular próximo retorno previsto
    v_next_return := (v_last_at AT TIME ZONE v_tz)::DATE + v_effective_days;

    -- 6. Upsert na tabela client_service_frequencies
    INSERT INTO public.client_service_frequencies (
        organization_id, client_id, service_id, last_professional_id, visit_count, first_service_at, last_service_at, average_interval_days, manual_interval_days, effective_interval_days, next_expected_return_at, calculation_mode, confidence_level, updated_at
    ) VALUES (
        p_org_id, p_client_id, p_service_id, v_last_prof_id, v_visit_count, v_first_at, v_last_at, v_avg_days, v_manual_days, v_effective_days, v_next_return, v_mode, v_confidence, NOW()
    ) ON CONFLICT (organization_id, client_id, service_id) DO UPDATE SET
        last_professional_id = EXCLUDED.last_professional_id,
        visit_count = EXCLUDED.visit_count,
        first_service_at = EXCLUDED.first_service_at,
        last_service_at = EXCLUDED.last_service_at,
        average_interval_days = EXCLUDED.average_interval_days,
        manual_interval_days = EXCLUDED.manual_interval_days,
        effective_interval_days = EXCLUDED.effective_interval_days,
        next_expected_return_at = EXCLUDED.next_expected_return_at,
        calculation_mode = EXCLUDED.calculation_mode,
        confidence_level = EXCLUDED.confidence_level,
        updated_at = NOW()
    RETURNING id INTO v_freq_id;

    -- 7. Se automação de alertas estiver ativada
    IF v_auto_create_alerts THEN
        -- Resolver alertas ativos antigos deste ciclo
        UPDATE public.return_alerts SET
            status = 'returned',
            resolved_at = NOW(),
            resolution = 'Novo atendimento concluído',
            updated_at = NOW()
        WHERE organization_id = p_org_id
          AND client_id = p_client_id
          AND service_id = p_service_id
          AND status IN ('upcoming', 'due', 'overdue', 'snoozed');

        -- Determinar status do novo alerta
        IF v_next_return < v_today THEN
            v_alert_status := 'overdue';
        ELSIF v_next_return = v_today THEN
            v_alert_status := 'due';
        ELSE
            v_alert_status := 'upcoming';
        END IF;

        -- Inserir ou atualizar próximo alerta
        INSERT INTO public.return_alerts (
            organization_id, client_id, service_id, client_service_frequency_id, expected_return_at, status, days_overdue, updated_at
        ) VALUES (
            p_org_id, p_client_id, p_service_id, v_freq_id, v_next_return, v_alert_status, GREATEST(0, (v_today - v_next_return)), NOW()
        ) ON CONFLICT (organization_id, client_id, service_id, expected_return_at) WHERE status IN ('upcoming', 'due', 'overdue', 'snoozed') DO UPDATE SET
            status = EXCLUDED.status,
            days_overdue = EXCLUDED.days_overdue,
            client_service_frequency_id = EXCLUDED.client_service_frequency_id,
            updated_at = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 5. RPC ATÔMICA SET_MANUAL_SERVICE_FREQUENCY
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

    IF v_user_role NOT IN ('owner', 'admin', 'receptionist') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil sem permissão para alterar frequência manual.';
    END IF;

    -- Atualizar ou inserir na tabela client_service_frequencies
    INSERT INTO public.client_service_frequencies (
        organization_id, client_id, service_id, manual_interval_days, updated_at
    ) VALUES (
        v_org_id, v_client_id, v_service_id, v_manual_days, NOW()
    ) ON CONFLICT (organization_id, client_id, service_id) DO UPDATE SET
        manual_interval_days = EXCLUDED.manual_interval_days,
        updated_at = NOW();

    -- Recalcular ciclo e alertas atomicamente
    PERFORM public.recalculate_client_service_frequency(v_client_id, v_service_id, v_org_id);

    SELECT to_jsonb(csf.*) INTO v_res
    FROM public.client_service_frequencies csf
    WHERE organization_id = v_org_id AND client_id = v_client_id AND service_id = v_service_id;

    RETURN v_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.set_manual_service_frequency FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_manual_service_frequency TO authenticated;


-- 6. HOOK NA RPC COMPLETE_APPOINTMENT PARA DISPARAR ATUALIZAÇÃO DE FREQUÊNCIAS
-- Adicionar loop ao final da complete_appointment chamando recalculate_client_service_frequency para cada serviço concluído
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
    v_svc_rec RECORD;
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

    IF v_user_role = 'professional' THEN
        SELECT id INTO v_linked_prof_id
        FROM public.professionals
        WHERE user_id = v_user_id AND organization_id = v_org_id AND is_active = TRUE;

        IF v_linked_prof_id IS NULL THEN
            RAISE EXCEPTION 'Acesso negado: O usuário não possui cadastro de profissional ativo nesta organização.';
        END IF;

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

    -- Limpar itens e pagamentos antigos
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

        SELECT price, counts_for_return_frequency INTO v_svc_price, v_counts_ret
        FROM public.services WHERE id = v_svc_id AND organization_id = v_org_id AND is_active = TRUE;

        IF v_svc_price IS NULL THEN
            RAISE EXCEPTION 'Erro: Serviço inválido ou inativo nesta organização.';
        END IF;

        IF v_svc_prof_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.professionals WHERE id = v_svc_prof_id AND organization_id = v_org_id AND is_active = TRUE
            ) THEN
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

    -- 11. Recalcular Frequências e Alertas por Serviço (Sprint 3)
    FOR v_svc_rec IN
        SELECT DISTINCT service_id FROM public.appointment_services
        WHERE appointment_id = v_app_id AND organization_id = v_org_id AND counts_for_return_frequency = TRUE
    LOOP
        PERFORM public.recalculate_client_service_frequency(v_client_id, v_svc_rec.service_id, v_org_id);
    END LOOP;

    SELECT jsonb_build_object('id', v_app_id, 'status', 'completed', 'total', v_total) INTO v_result;
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 7. SEED DE TEMPLATES DE MENSAGEM PADRÃO
INSERT INTO public.message_templates (organization_id, name, type, content, is_default, is_active)
SELECT 
    id,
    'Lembrete Padrão de Retorno',
    'return_reminder',
    'Olá, {{nome}}! Tudo bem? 😊

Já faz um tempinho desde o seu último {{servico}} aqui no {{salao}}.

Que tal reservar um horário para cuidar do visual novamente?

Se quiser agendar, é só falar com a gente por aqui!',
    TRUE,
    TRUE
FROM public.organizations
ON CONFLICT DO NOTHING;

INSERT INTO public.message_templates (organization_id, name, type, content, is_default, is_active)
SELECT 
    id,
    'Aviso de Retorno em Atraso',
    'overdue',
    'Olá, {{nome}}! Sentimos sua falta no {{salao}}! 💈

Seu último {{servico}} foi realizado em {{ultimo_atendimento}} com o profissional {{profissional}}.

Estamos com a agenda aberta para esta semana. Podemos reservar o seu horário?',
    TRUE,
    TRUE
FROM public.organizations
ON CONFLICT DO NOTHING;

INSERT INTO public.message_templates (organization_id, name, type, content, is_default, is_active)
SELECT 
    id,
    'Reativação de Cliente Inativo',
    'inactive_client',
    'Olá, {{nome}}! Faz {{dias_sem_atendimento}} dias que não nos vemos no {{salao}}! 👋

Preparamos um atendimento especial para sua volta. Que tal agendarmos seu próximo horário?',
    TRUE,
    TRUE
FROM public.organizations
ON CONFLICT DO NOTHING;
