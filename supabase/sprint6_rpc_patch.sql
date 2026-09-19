-- ==============================================================================
-- CABELLOS SAAS — PATCH DE CORREÇÃO DE AMBIGUIDADE E SPRINT 6 (RELATÓRIOS)
-- Arquivo leve e idempotente para execução direta no Supabase SQL Editor.
-- Atualiza todas as RPCs com qualificações explícitas de coluna e registra os relatórios.
-- ==============================================================================

--- SPRINT 6: RELATÓRIOS E INTELIGÊNCIA GERENCIAL ---
-- Migration 14: Sprint 6 — Relatórios e Inteligência Gerencial

-- 1. ÍNDICES DE ALTA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_appointments_reports 
  ON public.appointments (organization_id, status, finished_at, client_id);

CREATE INDEX IF NOT EXISTS idx_appointment_services_reports 
  ON public.appointment_services (organization_id, professional_id, service_id);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_reports 
  ON public.financial_transactions (organization_id, transaction_date, type, voided_at);

CREATE INDEX IF NOT EXISTS idx_accounts_receivable_reports 
  ON public.accounts_receivable (organization_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_accounts_payable_reports 
  ON public.accounts_payable (organization_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_client_packages_reports 
  ON public.client_packages (organization_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_package_usages_reports 
  ON public.package_usages (organization_id, client_package_id, used_at);


-- 2. HELPER INTERNO DE SEGURANÇA E MULTI-TENANT
CREATE OR REPLACE FUNCTION public.check_report_access(
    p_org_id UUID,
    p_required_roles TEXT[] DEFAULT ARRAY['admin', 'receptionist', 'professional']
)
RETURNS TABLE (
    out_user_id UUID,
    out_user_role TEXT,
    out_professional_id UUID,
    out_org_timezone TEXT
) AS $$
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

    -- Obter timezone do tenant
    SELECT COALESCE(o.timezone, 'America/Sao_Paulo') INTO v_tz
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 3. HELPER INTERNO DE VALIDAÇÃO DE FILTROS CROSS-TENANT
CREATE OR REPLACE FUNCTION public.validate_report_filters(
    p_org_id UUID,
    p_professional_id UUID DEFAULT NULL,
    p_service_id UUID DEFAULT NULL,
    p_client_id UUID DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_package_id UUID DEFAULT NULL,
    p_payment_method_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    IF p_professional_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.professionals prof WHERE prof.id = p_professional_id AND prof.organization_id = p_org_id) THEN
            RAISE EXCEPTION 'Filtro inválido para o tenant: profissional não pertence à organização.';
        END IF;
    END IF;

    IF p_service_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.services svc WHERE svc.id = p_service_id AND svc.organization_id = p_org_id) THEN
            RAISE EXCEPTION 'Filtro inválido para o tenant: serviço não pertence à organização.';
        END IF;
    END IF;

    IF p_client_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.clients cli WHERE cli.id = p_client_id AND cli.organization_id = p_org_id) THEN
            RAISE EXCEPTION 'Filtro inválido para o tenant: cliente não pertence à organização.';
        END IF;
    END IF;

    IF p_category_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.service_categories cat WHERE cat.id = p_category_id AND cat.organization_id = p_org_id) THEN
            RAISE EXCEPTION 'Filtro inválido para o tenant: categoria não pertence à organização.';
        END IF;
    END IF;

    IF p_package_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.packages pkg WHERE pkg.id = p_package_id AND pkg.organization_id = p_org_id) THEN
            RAISE EXCEPTION 'Filtro inválido para o tenant: pacote não pertence à organização.';
        END IF;
    END IF;

    IF p_payment_method_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.payment_methods pm WHERE pm.id = p_payment_method_id AND pm.organization_id = p_org_id) THEN
            RAISE EXCEPTION 'Filtro inválido para o tenant: meio de pagamento não pertence à organização.';
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 4. RPC: GET_EXECUTIVE_REPORT
CREATE OR REPLACE FUNCTION public.get_executive_report(
    p_org_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_access RECORD;
    v_producao NUMERIC := 0;
    v_recebimentos NUMERIC := 0;
    v_despesas NUMERIC := 0;
    v_resultado_caixa NUMERIC := 0;
    v_acc_rec_total NUMERIC := 0;
    v_acc_rec_overdue NUMERIC := 0;
    v_acc_rec_pending NUMERIC := 0;
    v_inadimplentes_count INT := 0;
    v_acc_pay_total NUMERIC := 0;
    v_acc_pay_overdue NUMERIC := 0;
    v_acc_pay_pending NUMERIC := 0;
    v_comissoes_a_pagar NUMERIC := 0;
    v_atendimentos_count INT := 0;
    v_clientes_atendidos INT := 0;
    v_ticket_operacional NUMERIC := 0;
BEGIN
    -- Validar acesso (Somente Owner, Admin, Receptionist)
    SELECT out_user_id AS user_id, out_user_role AS user_role, out_professional_id AS professional_id, out_org_timezone AS org_timezone
    INTO v_access FROM public.check_report_access(p_org_id, ARRAY['owner', 'admin', 'receptionist']);

    -- Produção Operacional (soma de appointment_services de agendamentos concluídos no período)
    SELECT COALESCE(SUM(aps.total), 0)
    INTO v_producao
    FROM public.appointment_services aps
    JOIN public.appointments a ON a.id = aps.appointment_id
    WHERE a.organization_id = p_org_id
      AND a.status = 'completed'
      AND a.finished_at >= p_start_date
      AND a.finished_at <= p_end_date;

    -- Recebimentos (financial_transactions validas type = income)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_recebimentos
    FROM public.financial_transactions
    WHERE organization_id = p_org_id
      AND type = 'income'
      AND voided_at IS NULL
      AND transaction_date >= p_start_date
      AND transaction_date <= p_end_date;

    -- Se Receptionist, ocultar indicadores financeiros globais restritos
    IF v_access.user_role = 'receptionist' THEN
        v_despesas := 0;
        v_resultado_caixa := 0;
        v_acc_pay_total := 0;
        v_acc_pay_overdue := 0;
        v_acc_pay_pending := 0;
        v_comissoes_a_pagar := 0;
    ELSE
        -- Despesas Pagas (financial_transactions validas type = expense)
        SELECT COALESCE(SUM(amount), 0)
        INTO v_despesas
        FROM public.financial_transactions
        WHERE organization_id = p_org_id
          AND type = 'expense'
          AND voided_at IS NULL
          AND transaction_date >= p_start_date
          AND transaction_date <= p_end_date;

        v_resultado_caixa := v_recebimentos - v_despesas;

        -- Contas a Pagar
        SELECT COALESCE(SUM(remaining_amount), 0)
        INTO v_acc_pay_total
        FROM public.accounts_payable
        WHERE organization_id = p_org_id
          AND status IN ('pending', 'partial');

        SELECT COALESCE(SUM(remaining_amount), 0)
        INTO v_acc_pay_overdue
        FROM public.accounts_payable
        WHERE organization_id = p_org_id
          AND status IN ('pending', 'partial')
          AND due_date < CURRENT_DATE;

        v_acc_pay_pending := v_acc_pay_total - v_acc_pay_overdue;

        -- Comissões a Pagar
        SELECT COALESCE(SUM(commission_amount), 0)
        INTO v_comissoes_a_pagar
        FROM public.commissions
        WHERE organization_id = p_org_id
          AND status IN ('calculated', 'approved');
    END IF;

    -- Contas a Receber
    SELECT COALESCE(SUM(remaining_amount), 0)
    INTO v_acc_rec_total
    FROM public.accounts_receivable
    WHERE organization_id = p_org_id
      AND status IN ('pending', 'partial');

    SELECT COALESCE(SUM(remaining_amount), 0)
    INTO v_acc_rec_overdue
    FROM public.accounts_receivable
    WHERE organization_id = p_org_id
      AND status IN ('pending', 'partial')
      AND due_date < CURRENT_DATE;

    v_acc_rec_pending := v_acc_rec_total - v_acc_rec_overdue;

    SELECT COUNT(DISTINCT client_id)
    INTO v_inadimplentes_count
    FROM public.accounts_receivable
    WHERE organization_id = p_org_id
      AND status IN ('pending', 'partial')
      AND due_date < CURRENT_DATE;

    -- Atendimentos concluídos e clientes atendidos
    SELECT COUNT(appointments.id), COUNT(DISTINCT appointments.client_id)
    INTO v_atendimentos_count, v_clientes_atendidos
    FROM public.appointments
    WHERE organization_id = p_org_id
      AND status = 'completed'
      AND finished_at >= p_start_date
      AND finished_at <= p_end_date;

    IF v_atendimentos_count > 0 THEN
        v_ticket_operacional := ROUND(v_producao / v_atendimentos_count, 2);
    ELSE
        v_ticket_operacional := 0;
    END IF;

    RETURN jsonb_build_object(
        'producao_operacional', v_producao,
        'recebimentos', v_recebimentos,
        'despesas_pagas', v_despesas,
        'resultado_caixa', v_resultado_caixa,
        'contas_a_receber_total', v_acc_rec_total,
        'contas_a_receber_vencidas', v_acc_rec_overdue,
        'contas_a_receber_a_vencer', v_acc_rec_pending,
        'inadimplentes_count', v_inadimplentes_count,
        'contas_a_pagar_total', v_acc_pay_total,
        'contas_a_pagar_vencidas', v_acc_pay_overdue,
        'contas_a_pagar_a_vencer', v_acc_pay_pending,
        'comissoes_a_pagar', v_comissoes_a_pagar,
        'atendimentos_concluidos_count', v_atendimentos_count,
        'clientes_atendidos_count', v_clientes_atendidos,
        'ticket_medio_operacional', v_ticket_operacional
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_executive_report FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_executive_report TO authenticated;


-- 5. RPC: GET_CLIENT_RETENTION_REPORT
CREATE OR REPLACE FUNCTION public.get_client_retention_report(
    p_org_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_access RECORD;
    v_inactive_days INT := 30;
    v_novos_count INT := 0;
    v_recorrentes_count INT := 0;
    v_atendidos_count INT := 0;
    v_taxa_recorrencia NUMERIC := NULL;
    v_conversao_retorno NUMERIC := NULL;
    v_alertas_returned INT := 0;
    v_alertas_elegiveis INT := 0;
    v_inativos_list JSONB;
    v_atrasados_list JSONB;
    v_frequencias_list JSONB;
BEGIN
    SELECT out_user_id AS user_id, out_user_role AS user_role, out_professional_id AS professional_id, out_org_timezone AS org_timezone
    INTO v_access FROM public.check_report_access(p_org_id, ARRAY['owner', 'admin', 'receptionist']);

    -- Obter dias de inatividade configurados no tenant
    SELECT COALESCE(o.inactive_client_days, 30) INTO v_inactive_days
    FROM public.organizations o WHERE o.id = p_org_id;

    -- Total de clientes distintos atendidos no período
    SELECT COUNT(DISTINCT client_id)
    INTO v_atendidos_count
    FROM public.appointments
    WHERE organization_id = p_org_id
      AND status = 'completed'
      AND finished_at >= p_start_date
      AND finished_at <= p_end_date;

    -- Novos Clientes: first_appointment_at no período
    SELECT COUNT(DISTINCT c.id)
    INTO v_novos_count
    FROM public.clients c
    JOIN public.appointments a ON a.client_id = c.id
    WHERE c.organization_id = p_org_id
      AND a.status = 'completed'
      AND a.finished_at >= p_start_date
      AND a.finished_at <= p_end_date
      AND c.first_appointment_at >= p_start_date
      AND c.first_appointment_at <= p_end_date;

    -- Clientes Recorrentes: atendidos no período E com atendimento concluído antes do início do período
    SELECT COUNT(DISTINCT a.client_id)
    INTO v_recorrentes_count
    FROM public.appointments a
    WHERE a.organization_id = p_org_id
      AND a.status = 'completed'
      AND a.finished_at >= p_start_date
      AND a.finished_at <= p_end_date
      AND EXISTS (
          SELECT 1 FROM public.appointments prev
          WHERE prev.organization_id = p_org_id
            AND prev.client_id = a.client_id
            AND prev.status = 'completed'
            AND prev.finished_at < p_start_date
      );

    IF v_atendidos_count > 0 THEN
        v_taxa_recorrencia := ROUND((v_recorrentes_count::NUMERIC / v_atendidos_count::NUMERIC) * 100, 2);
    ELSE
        v_taxa_recorrencia := NULL;
    END IF;

    -- Conversão da Central de Retornos (Alertas encerrados no período)
    SELECT COUNT(*)
    INTO v_alertas_elegiveis
    FROM public.return_alerts
    WHERE organization_id = p_org_id
      AND status IN ('returned', 'expired', 'cancelled')
      AND updated_at >= p_start_date
      AND updated_at <= p_end_date;

    SELECT COUNT(*)
    INTO v_alertas_returned
    FROM public.return_alerts
    WHERE organization_id = p_org_id
      AND status = 'returned'
      AND updated_at >= p_start_date
      AND updated_at <= p_end_date;

    IF v_alertas_elegiveis > 0 THEN
        v_conversao_retorno := ROUND((v_alertas_returned::NUMERIC / v_alertas_elegiveis::NUMERIC) * 100, 2);
    ELSE
        v_conversao_retorno := NULL;
    END IF;

    -- Lista de Clientes Inativos (com histórico prévio e sem atendimentos nos últimos N dias)
    SELECT jsonb_agg(item) INTO v_inativos_list
    FROM (
        SELECT 
            c.id,
            c.name,
            c.phone,
            c.last_appointment_at,
            ROUND(COALESCE(SUM(aps.total), 0), 2) AS total_historico,
            DATE_PART('day', NOW() - c.last_appointment_at)::INT AS dias_inativo
        FROM public.clients c
        LEFT JOIN public.appointments a ON a.client_id = c.id AND a.status = 'completed'
        LEFT JOIN public.appointment_services aps ON aps.appointment_id = a.id
        WHERE c.organization_id = p_org_id
          AND c.last_appointment_at IS NOT NULL
          AND c.last_appointment_at < (NOW() - (v_inactive_days || ' days')::INTERVAL)
        GROUP BY c.id, c.name, c.phone, c.last_appointment_at
        ORDER BY c.last_appointment_at ASC
        LIMIT 50
    ) item;

    -- Lista de Clientes Atrasados (alertas overdue)
    SELECT jsonb_agg(item) INTO v_atrasados_list
    FROM (
        SELECT 
            ra.id AS alert_id,
            c.name AS client_name,
            c.phone AS client_phone,
            s.name AS service_name,
            p.name AS professional_name,
            ra.due_date,
            DATE_PART('day', NOW() - ra.due_date)::INT AS dias_atraso,
            c.last_appointment_at,
            csf.average_frequency_days
        FROM public.return_alerts ra
        JOIN public.clients c ON c.id = ra.client_id
        JOIN public.services s ON s.id = ra.service_id
        LEFT JOIN public.professionals p ON p.id = ra.preferred_professional_id
        LEFT JOIN public.client_service_frequencies csf ON csf.client_id = c.id AND csf.service_id = s.id
        WHERE ra.organization_id = p_org_id
          AND ra.status = 'overdue'
        ORDER BY ra.due_date ASC
        LIMIT 50
    ) item;

    -- Frequência Média por Serviço
    SELECT jsonb_agg(item) INTO v_frequencias_list
    FROM (
        SELECT 
            s.name AS service_name,
            ROUND(AVG(csf.average_frequency_days), 1) AS avg_frequency_days,
            COUNT(DISTINCT csf.client_id) AS clients_count
        FROM public.client_service_frequencies csf
        JOIN public.services s ON s.id = csf.service_id
        WHERE csf.organization_id = p_org_id
        GROUP BY s.id, s.name
        ORDER BY clients_count DESC
    ) item;

    RETURN jsonb_build_object(
        'novos_clientes_count', v_novos_count,
        'recorrentes_count', v_recorrentes_count,
        'clientes_atendidos_count', v_atendidos_count,
        'taxa_recorrencia', v_taxa_recorrencia,
        'conversao_retorno', v_conversao_retorno,
        'alertas_returned_count', v_alertas_returned,
        'alertas_elegiveis_count', v_alertas_elegiveis,
        'clientes_inativos', COALESCE(v_inativos_list, '[]'::jsonb),
        'clientes_atrasados', COALESCE(v_atrasados_list, '[]'::jsonb),
        'frequencias_por_servico', COALESCE(v_frequencias_list, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_client_retention_report FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_retention_report TO authenticated;


-- 6. RPC: GET_SERVICES_REPORT
CREATE OR REPLACE FUNCTION public.get_services_report(
    p_org_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_service_id UUID DEFAULT NULL,
    p_category_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_access RECORD;
    v_services_list JSONB;
    v_categories_list JSONB;
    v_total_producao NUMERIC := 0;
    v_total_qtd INT := 0;
BEGIN
    SELECT out_user_id AS user_id, out_user_role AS user_role, out_professional_id AS professional_id, out_org_timezone AS org_timezone
    INTO v_access FROM public.check_report_access(p_org_id, ARRAY['owner', 'admin', 'receptionist']);
    PERFORM public.validate_report_filters(p_org_id, p_service_id => p_service_id, p_category_id => p_category_id);

    -- Total da produção de serviços para cálculo percentual
    SELECT COALESCE(SUM(aps.total), 0), COUNT(aps.id)
    INTO v_total_producao, v_total_qtd
    FROM public.appointment_services aps
    JOIN public.appointments a ON a.id = aps.appointment_id
    JOIN public.services s ON s.id = aps.service_id
    WHERE a.organization_id = p_org_id
      AND a.status = 'completed'
      AND a.finished_at >= p_start_date
      AND a.finished_at <= p_end_date
      AND (p_service_id IS NULL OR aps.service_id = p_service_id)
      AND (p_category_id IS NULL OR s.category_id = p_category_id);

    -- Ranking de Serviços
    SELECT jsonb_agg(item) INTO v_services_list
    FROM (
        SELECT 
            s.id AS service_id,
            s.name AS service_name,
            sc.name AS category_name,
            COUNT(aps.id) AS quantidade,
            ROUND(SUM(aps.total), 2) AS producao_total,
            ROUND(SUM(CASE WHEN aps.client_package_id IS NOT NULL THEN aps.total ELSE 0 END), 2) AS producao_plano,
            ROUND(SUM(CASE WHEN aps.client_package_id IS NULL THEN aps.total ELSE 0 END), 2) AS producao_direta,
            ROUND(AVG(aps.unit_price), 2) AS ticket_medio,
            COUNT(DISTINCT a.client_id) AS clientes_distintos,
            COUNT(DISTINCT aps.professional_id) AS profissionais_distintos,
            CASE WHEN v_total_producao > 0 THEN ROUND((SUM(aps.total) / v_total_producao) * 100, 2) ELSE 0 END AS percentual_producao
        FROM public.appointment_services aps
        JOIN public.appointments a ON a.id = aps.appointment_id
        JOIN public.services s ON s.id = aps.service_id
        LEFT JOIN public.service_categories sc ON sc.id = s.category_id
        WHERE a.organization_id = p_org_id
          AND a.status = 'completed'
          AND a.finished_at >= p_start_date
          AND a.finished_at <= p_end_date
          AND (p_service_id IS NULL OR aps.service_id = p_service_id)
          AND (p_category_id IS NULL OR s.category_id = p_category_id)
        GROUP BY s.id, s.name, sc.name
        ORDER BY producao_total DESC
        LIMIT 50
    ) item;

    -- Agrupamento por Categoria
    SELECT jsonb_agg(item) INTO v_categories_list
    FROM (
        SELECT 
            COALESCE(sc.name, 'Sem Categoria') AS category_name,
            COUNT(aps.id) AS quantidade,
            ROUND(SUM(aps.total), 2) AS producao_total,
            CASE WHEN v_total_producao > 0 THEN ROUND((SUM(aps.total) / v_total_producao) * 100, 2) ELSE 0 END AS percentual_producao
        FROM public.appointment_services aps
        JOIN public.appointments a ON a.id = aps.appointment_id
        JOIN public.services s ON s.id = aps.service_id
        LEFT JOIN public.service_categories sc ON sc.id = s.category_id
        WHERE a.organization_id = p_org_id
          AND a.status = 'completed'
          AND a.finished_at >= p_start_date
          AND a.finished_at <= p_end_date
          AND (p_service_id IS NULL OR aps.service_id = p_service_id)
          AND (p_category_id IS NULL OR s.category_id = p_category_id)
        GROUP BY sc.name
        ORDER BY producao_total DESC
    ) item;

    RETURN jsonb_build_object(
        'total_producao', v_total_producao,
        'total_quantidade', v_total_qtd,
        'ranking_servicos', COALESCE(v_services_list, '[]'::jsonb),
        'por_categoria', COALESCE(v_categories_list, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_services_report FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_services_report TO authenticated;


-- 7. RPC: GET_PROFESSIONALS_REPORT
CREATE OR REPLACE FUNCTION public.get_professionals_report(
    p_org_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_professional_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_access RECORD;
    v_target_prof_id UUID := p_professional_id;
    v_prof_list JSONB;
BEGIN
    SELECT out_user_id AS user_id, out_user_role AS user_role, out_professional_id AS professional_id, out_org_timezone AS org_timezone
    INTO v_access FROM public.check_report_access(p_org_id, ARRAY['owner', 'admin', 'receptionist', 'professional']);

    -- Se o perfil for 'professional', restringir estritamente ao seu próprio profissional
    IF v_access.user_role = 'professional' THEN
        IF v_access.professional_id IS NULL THEN
            RAISE EXCEPTION 'Perfil profissional sem registro vinculado nesta organização.';
        END IF;
        IF p_professional_id IS NOT NULL AND p_professional_id <> v_access.professional_id THEN
            RAISE EXCEPTION 'Filtro rejeitado: Profissionais não podem visualizar dados de outros profissionais.';
        END IF;
        v_target_prof_id := v_access.professional_id;
    ELSE
        PERFORM public.validate_report_filters(p_org_id, p_professional_id => p_professional_id);
    END IF;

    SELECT jsonb_agg(item) INTO v_prof_list
    FROM (
        SELECT 
            p.id AS professional_id,
            p.name AS professional_name,
            COUNT(DISTINCT a.id) AS atendimentos_count,
            COUNT(aps.id) AS servicos_count,
            ROUND(COALESCE(SUM(aps.total), 0), 2) AS producao_operacional,
            CASE WHEN COUNT(DISTINCT a.id) > 0 THEN ROUND(SUM(aps.total) / COUNT(DISTINCT a.id), 2) ELSE 0 END AS ticket_medio_operacional,
            COUNT(DISTINCT a.client_id) AS clientes_distintos,
            -- Comissões
            ROUND(COALESCE(SUM(ci.commission_amount), 0), 2) AS comissao_gerada,
            ROUND(COALESCE(SUM(CASE WHEN comm.status = 'calculated' THEN ci.commission_amount ELSE 0 END), 0), 2) AS comissao_calculada,
            ROUND(COALESCE(SUM(CASE WHEN comm.status = 'approved' THEN ci.commission_amount ELSE 0 END), 0), 2) AS comissao_aprovada,
            ROUND(COALESCE(SUM(CASE WHEN comm.status = 'paid' THEN ci.commission_amount ELSE 0 END), 0), 2) AS comissao_paga
        FROM public.professionals p
        LEFT JOIN public.appointment_services aps ON aps.professional_id = p.id
        LEFT JOIN public.appointments a ON a.id = aps.appointment_id AND a.status = 'completed' AND a.finished_at >= p_start_date AND a.finished_at <= p_end_date
        LEFT JOIN public.commission_items ci ON ci.appointment_service_id = aps.id
        LEFT JOIN public.commissions comm ON comm.id = ci.commission_id
        WHERE p.organization_id = p_org_id
          AND (v_target_prof_id IS NULL OR p.id = v_target_prof_id)
        GROUP BY p.id, p.name
        ORDER BY producao_operacional DESC
    ) item;

    RETURN jsonb_build_object(
        'profissionais', COALESCE(v_prof_list, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_professionals_report FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_professionals_report TO authenticated;


-- 8. RPC: GET_PACKAGES_REPORT
CREATE OR REPLACE FUNCTION public.get_packages_report(
    p_org_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_access RECORD;
    v_vendidos_count INT := 0;
    v_ativos_count INT := 0;
    v_expirados_count INT := 0;
    v_concluidos_count INT := 0;
    v_cancelados_count INT := 0;
    v_recebimentos_planos NUMERIC := 0;
    v_elegiveis_renovacao INT := 0;
    v_renovados_count INT := 0;
    v_taxa_renovacao NUMERIC := NULL;
    v_ranking_produtos JSONB;
    v_usages_summary JSONB;
    v_unlimited_summary JSONB;
    v_credits_summary JSONB;
    v_vencendo_list JSONB;
BEGIN
    SELECT out_user_id AS user_id, out_user_role AS user_role, out_professional_id AS professional_id, out_org_timezone AS org_timezone
    INTO v_access FROM public.check_report_access(p_org_id, ARRAY['owner', 'admin', 'receptionist']);

    -- Contratos Vendidos no período
    SELECT COUNT(*)
    INTO v_vendidos_count
    FROM public.client_packages
    WHERE organization_id = p_org_id
      AND purchased_at >= p_start_date
      AND purchased_at <= p_end_date;

    -- Status dos Contratos
    SELECT 
        COUNT(CASE WHEN status = 'active' THEN 1 END),
        COUNT(CASE WHEN status = 'expired' THEN 1 END),
        COUNT(CASE WHEN status = 'completed' THEN 1 END),
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END)
    INTO v_ativos_count, v_expirados_count, v_concluidos_count, v_cancelados_count
    FROM public.client_packages
    WHERE organization_id = p_org_id;

    -- Recebimentos Efetivos de Planos
    SELECT COALESCE(SUM(ft.amount), 0)
    INTO v_recebimentos_planos
    FROM public.financial_transactions ft
    JOIN public.financial_categories fc ON fc.id = ft.category_id
    WHERE ft.organization_id = p_org_id
      AND ft.type = 'income'
      AND ft.voided_at IS NULL
      AND fc.name = 'Venda de Pacotes'
      AND ft.transaction_date >= p_start_date
      AND ft.transaction_date <= p_end_date;

    -- Taxa de Renovação: Contratos expirados/concluídos no período
    SELECT COUNT(*)
    INTO v_elegiveis_renovacao
    FROM public.client_packages
    WHERE organization_id = p_org_id
      AND status IN ('expired', 'completed')
      AND (
          (expires_at >= p_start_date AND expires_at <= p_end_date)
          OR (updated_at >= p_start_date AND updated_at <= p_end_date)
      );

    SELECT COUNT(DISTINCT new_cp.renewed_from_client_package_id)
    INTO v_renovados_count
    FROM public.client_packages new_cp
    JOIN public.client_packages orig_cp ON orig_cp.id = new_cp.renewed_from_client_package_id
    WHERE new_cp.organization_id = p_org_id
      AND orig_cp.status IN ('expired', 'completed')
      AND (
          (orig_cp.expires_at >= p_start_date AND orig_cp.expires_at <= p_end_date)
          OR (orig_cp.updated_at >= p_start_date AND orig_cp.updated_at <= p_end_date)
      )
      AND new_cp.purchased_at <= (COALESCE(orig_cp.expires_at, orig_cp.updated_at) + INTERVAL '30 days');

    IF v_elegiveis_renovacao > 0 THEN
        v_taxa_renovacao := ROUND((v_renovados_count::NUMERIC / v_elegiveis_renovacao::NUMERIC) * 100, 2);
    ELSE
        v_taxa_renovacao := NULL;
    END IF;

    -- Ranking por Produto Comercial
    SELECT jsonb_agg(item) INTO v_ranking_produtos
    FROM (
        SELECT 
            p.name AS package_name,
            p.type AS package_type,
            COUNT(cp.id) AS quantidade_vendida,
            ROUND(COALESCE(SUM(cp.total_amount), 0), 2) AS receita_recebida,
            COUNT(CASE WHEN cp.status = 'active' THEN 1 END) AS clientes_ativos,
            COUNT(DISTINCT renew.id) AS renovacoes_count
        FROM public.packages p
        JOIN public.client_packages cp ON cp.package_id = p.id
        LEFT JOIN public.client_packages renew ON renew.renewed_from_client_package_id = cp.id
        WHERE p.organization_id = p_org_id
          AND cp.purchased_at >= p_start_date
          AND cp.purchased_at <= p_end_date
        GROUP BY p.id, p.name, p.type
        ORDER BY quantidade_vendida DESC
    ) item;

    -- Usos dos Planos (Usages breakdown)
    SELECT jsonb_agg(item) INTO v_usages_summary
    FROM (
        SELECT 
            p.type AS package_type,
            COUNT(pu.id) AS utilizacoes_count,
            COUNT(DISTINCT cp.client_id) AS clientes_utilizadores
        FROM public.package_usages pu
        JOIN public.client_packages cp ON cp.id = pu.client_package_id
        JOIN public.packages p ON p.id = cp.package_id
        WHERE cp.organization_id = p_org_id
          AND pu.used_at >= p_start_date
          AND pu.used_at <= p_end_date
        GROUP BY p.type
    ) item;

    -- Planos Ilimitados (Relação Receita x Consumo)
    SELECT jsonb_build_object(
        'valor_recebido', ROUND(COALESCE(SUM(cp.total_amount), 0), 2),
        'producao_consumida', ROUND(COALESCE(SUM(aps.total), 0), 2),
        'relacao_receita_consumo', ROUND(COALESCE(SUM(cp.total_amount), 0) - COALESCE(SUM(aps.total), 0), 2)
    ) INTO v_unlimited_summary
    FROM public.client_packages cp
    JOIN public.packages p ON p.id = cp.package_id
    LEFT JOIN public.package_usages pu ON pu.client_package_id = cp.id AND pu.used_at >= p_start_date AND pu.used_at <= p_end_date
    LEFT JOIN public.appointment_services aps ON aps.id = pu.appointment_service_id
    WHERE cp.organization_id = p_org_id
      AND p.type = 'unlimited';

    -- Pacotes de Crédito (Taxa de Utilização)
    SELECT jsonb_build_object(
        'creditos_contratados', COALESCE(SUM(cpi.total_qty), 0),
        'creditos_utilizados', COALESCE(SUM(cpi.used_qty), 0),
        'creditos_restantes', COALESCE(SUM(cpi.remaining_qty), 0),
        'taxa_utilizacao', CASE WHEN SUM(cpi.total_qty) > 0 THEN ROUND((SUM(cpi.used_qty)::NUMERIC / SUM(cpi.total_qty)::NUMERIC) * 100, 2) ELSE 0 END
    ) INTO v_credits_summary
    FROM public.client_package_items cpi
    JOIN public.client_packages cp ON cp.id = cpi.client_package_id
    WHERE cp.organization_id = p_org_id;

    -- Planos Próximos do Vencimento (Próximos 30 dias)
    SELECT jsonb_agg(item) INTO v_vencendo_list
    FROM (
        SELECT 
            cp.id AS contract_id,
            c.name AS client_name,
            p.name AS package_name,
            cp.expires_at,
            DATE_PART('day', cp.expires_at - NOW())::INT AS dias_para_vencer
        FROM public.client_packages cp
        JOIN public.clients c ON c.id = cp.client_id
        JOIN public.packages p ON p.id = cp.package_id
        WHERE cp.organization_id = p_org_id
          AND cp.status = 'active'
          AND cp.expires_at >= NOW()
          AND cp.expires_at <= (NOW() + INTERVAL '30 days')
        ORDER BY cp.expires_at ASC
    ) item;

    RETURN jsonb_build_object(
        'vendidos_count', v_vendidos_count,
        'ativos_count', v_ativos_count,
        'expirados_count', v_expirados_count,
        'concluidos_count', v_concluidos_count,
        'cancelados_count', v_cancelados_count,
        'recebimentos_planos', v_recebimentos_planos,
        'taxa_renovacao', v_taxa_renovacao,
        'elegiveis_renovacao_count', v_elegiveis_renovacao,
        'renovados_count', v_renovados_count,
        'ranking_produtos', COALESCE(v_ranking_produtos, '[]'::jsonb),
        'resumo_usos', COALESCE(v_usages_summary, '[]'::jsonb),
        'ilimitados_summary', v_unlimited_summary,
        'creditos_summary', v_credits_summary,
        'planos_vencendo', COALESCE(v_vencendo_list, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_packages_report FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_packages_report TO authenticated;


-- 9. RPC: GET_FINANCIAL_REPORT
CREATE OR REPLACE FUNCTION public.get_financial_report(
    p_org_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_access RECORD;
    v_diff_days INT;
    v_trunc_unit TEXT := 'day';
    v_series JSONB;
    v_meios_pagamento JSONB;
    v_aging JSONB;
    v_contas_pagar JSONB;
    v_despesas_categorias JSONB;
    v_caixa_summary JSONB;
    v_divergencias JSONB;
    v_auditoria JSONB;
    v_carteira_vencida_pct NUMERIC := NULL;
    v_saldo_total_aberto NUMERIC := 0;
    v_saldo_vencido NUMERIC := 0;
BEGIN
    -- Acesso RESTRITO a Owner e Admin
    SELECT out_user_id AS user_id, out_user_role AS user_role, out_professional_id AS professional_id, out_org_timezone AS org_timezone
    INTO v_access FROM public.check_report_access(p_org_id, ARRAY['owner', 'admin']);

    -- Ajustar granularidade temporal
    v_diff_days := DATE_PART('day', p_end_date - p_start_date)::INT;
    IF v_diff_days <= 31 THEN
        v_trunc_unit := 'day';
    ELSIF v_diff_days <= 180 THEN
        v_trunc_unit := 'week';
    ELSE
        v_trunc_unit := 'month';
    END IF;

    -- Séries Temporais de Produção, Recebimentos, Despesas e Resultado de Caixa
    SELECT jsonb_agg(item) INTO v_series
    FROM (
        SELECT 
            DATE_TRUNC(v_trunc_unit, t.date_val AT TIME ZONE v_access.org_timezone)::DATE AS data_periodo,
            SUM(t.producao) AS producao,
            SUM(t.recebimentos) AS recebimentos,
            SUM(t.despesas) AS despesas,
            SUM(t.recebimentos) - SUM(t.despesas) AS resultado_caixa
        FROM (
            SELECT a.finished_at AS date_val, aps.total AS producao, 0 AS recebimentos, 0 AS despesas
            FROM public.appointment_services aps
            JOIN public.appointments a ON a.id = aps.appointment_id
            WHERE a.organization_id = p_org_id AND a.status = 'completed' AND a.finished_at >= p_start_date AND a.finished_at <= p_end_date

            UNION ALL

            SELECT transaction_date AS date_val, 0 AS producao, amount AS recebimentos, 0 AS despesas
            FROM public.financial_transactions
            WHERE organization_id = p_org_id AND type = 'income' AND voided_at IS NULL AND transaction_date >= p_start_date AND transaction_date <= p_end_date

            UNION ALL

            SELECT transaction_date AS date_val, 0 AS producao, 0 AS recebimentos, amount AS despesas
            FROM public.financial_transactions
            WHERE organization_id = p_org_id AND type = 'expense' AND voided_at IS NULL AND transaction_date >= p_start_date AND transaction_date <= p_end_date
        ) t
        GROUP BY DATE_TRUNC(v_trunc_unit, t.date_val AT TIME ZONE v_access.org_timezone)
        ORDER BY data_periodo ASC
    ) item;

    -- Recebimentos por Meio de Pagamento
    SELECT jsonb_agg(item) INTO v_meios_pagamento
    FROM (
        SELECT 
            COALESCE(pm.name, 'Outros') AS meio_pagamento,
            pm.type AS tipo_pagamento,
            ROUND(SUM(ft.amount), 2) AS valor_total,
            COUNT(ft.id) AS transacoes_count
        FROM public.financial_transactions ft
        LEFT JOIN public.payment_methods pm ON pm.id = ft.payment_method_id
        WHERE ft.organization_id = p_org_id
          AND ft.type = 'income'
          AND ft.voided_at IS NULL
          AND ft.transaction_date >= p_start_date
          AND ft.transaction_date <= p_end_date
        GROUP BY pm.name, pm.type
        ORDER BY valor_total DESC
    ) item;

    -- Aging de Contas a Receber (6 faixas)
    SELECT jsonb_build_object(
        'a_vencer', ROUND(COALESCE(SUM(CASE WHEN due_date >= CURRENT_DATE THEN remaining_amount ELSE 0 END), 0), 2),
        'dias_1_7', ROUND(COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - 7 THEN remaining_amount ELSE 0 END), 0), 2),
        'dias_8_15', ROUND(COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE - 7 AND due_date >= CURRENT_DATE - 15 THEN remaining_amount ELSE 0 END), 0), 2),
        'dias_16_30', ROUND(COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE - 15 AND due_date >= CURRENT_DATE - 30 THEN remaining_amount ELSE 0 END), 0), 2),
        'dias_31_60', ROUND(COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE - 30 AND due_date >= CURRENT_DATE - 60 THEN remaining_amount ELSE 0 END), 0), 2),
        'dias_60_mais', ROUND(COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE - 60 THEN remaining_amount ELSE 0 END), 0), 2)
    ) INTO v_aging
    FROM public.accounts_receivable
    WHERE organization_id = p_org_id
      AND status IN ('pending', 'partial');

    -- Carteira Vencida
    SELECT 
        COALESCE(SUM(remaining_amount), 0),
        COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE THEN remaining_amount ELSE 0 END), 0)
    INTO v_saldo_total_aberto, v_saldo_vencido
    FROM public.accounts_receivable
    WHERE organization_id = p_org_id
      AND status IN ('pending', 'partial');

    IF v_saldo_total_aberto > 0 THEN
        v_carteira_vencida_pct := ROUND((v_saldo_vencido / v_saldo_total_aberto) * 100, 2);
    ELSE
        v_carteira_vencida_pct := NULL;
    END IF;

    -- Contas a Pagar (Prazos)
    SELECT jsonb_build_object(
        'vencido', ROUND(COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE THEN remaining_amount ELSE 0 END), 0), 2),
        'hoje', ROUND(COALESCE(SUM(CASE WHEN due_date = CURRENT_DATE THEN remaining_amount ELSE 0 END), 0), 2),
        'proximos_7_dias', ROUND(COALESCE(SUM(CASE WHEN due_date > CURRENT_DATE AND due_date <= CURRENT_DATE + 7 THEN remaining_amount ELSE 0 END), 0), 2),
        'proximos_30_dias', ROUND(COALESCE(SUM(CASE WHEN due_date > CURRENT_DATE + 7 AND due_date <= CURRENT_DATE + 30 THEN remaining_amount ELSE 0 END), 0), 2)
    ) INTO v_contas_pagar
    FROM public.accounts_payable
    WHERE organization_id = p_org_id
      AND status IN ('pending', 'partial');

    -- Despesas por Categoria
    SELECT jsonb_agg(item) INTO v_despesas_categorias
    FROM (
        SELECT 
            COALESCE(fc.name, 'Outras Despesas') AS categoria_nome,
            ROUND(COALESCE(SUM(ft.amount), 0), 2) AS valor_pago,
            ROUND(COALESCE(SUM(ap.remaining_amount), 0), 2) AS valor_a_pagar,
            ROUND(COALESCE(SUM(ft.amount), 0) + COALESCE(SUM(ap.remaining_amount), 0), 2) AS total_comprometido
        FROM public.financial_categories fc
        LEFT JOIN public.financial_transactions ft ON ft.category_id = fc.id AND ft.type = 'expense' AND ft.voided_at IS NULL AND ft.transaction_date >= p_start_date AND ft.transaction_date <= p_end_date
        LEFT JOIN public.accounts_payable ap ON ap.category_id = fc.id AND ap.status IN ('pending', 'partial')
        WHERE fc.organization_id = p_org_id
          AND fc.type = 'expense'
        GROUP BY fc.id, fc.name
        ORDER BY total_comprometido DESC
    ) item;

    -- Movimentos de Caixa
    SELECT jsonb_build_object(
        'aberturas', COUNT(CASE WHEN status = 'open' THEN 1 END),
        'fechamentos', COUNT(CASE WHEN status = 'closed' THEN 1 END),
        'total_diferencas', ROUND(COALESCE(SUM(difference_amount), 0), 2)
    ) INTO v_caixa_summary
    FROM public.cash_registers
    WHERE organization_id = p_org_id
      AND opened_at >= p_start_date
      AND opened_at <= p_end_date;

    -- Divergências de Caixa
    SELECT jsonb_agg(item) INTO v_divergencias
    FROM (
        SELECT 
            cr.id AS cash_register_id,
            cr.closed_at,
            prof.name AS responsavel_nome,
            cr.expected_balance,
            cr.actual_balance,
            cr.difference_amount,
            cr.closure_notes
        FROM public.cash_registers cr
        LEFT JOIN public.profiles prof ON prof.id = cr.opened_by
        WHERE cr.organization_id = p_org_id
          AND cr.status = 'closed'
          AND cr.difference_amount <> 0
          AND cr.closed_at >= p_start_date
          AND cr.closed_at <= p_end_date
        ORDER BY cr.closed_at DESC
        LIMIT 20
    ) item;

    -- Auditoria de Transações
    SELECT jsonb_agg(item) INTO v_auditoria
    FROM (
        SELECT 
            ft.id AS transaction_id,
            ft.type,
            ft.amount,
            ft.description,
            ft.source_type,
            ft.source_id,
            ft.created_at,
            p_created.name AS created_by_name,
            ft.voided_at,
            p_voided.name AS voided_by_name,
            ft.void_reason
        FROM public.financial_transactions ft
        LEFT JOIN public.profiles p_created ON p_created.id = ft.created_by
        LEFT JOIN public.profiles p_voided ON p_voided.id = ft.voided_by
        WHERE ft.organization_id = p_org_id
          AND ft.created_at >= p_start_date
          AND ft.created_at <= p_end_date
        ORDER BY ft.created_at DESC
        LIMIT 50
    ) item;

    RETURN jsonb_build_object(
        'series_temporais', COALESCE(v_series, '[]'::jsonb),
        'meios_pagamento', COALESCE(v_meios_pagamento, '[]'::jsonb),
        'aging_contas_receber', v_aging,
        'carteira_vencida_pct', v_carteira_vencida_pct,
        'saldo_total_aberto', v_saldo_total_aberto,
        'saldo_vencido', v_saldo_vencido,
        'contas_pagar', v_contas_pagar,
        'despesas_categorias', COALESCE(v_despesas_categorias, '[]'::jsonb),
        'caixa_summary', v_caixa_summary,
        'divergencias_caixa', COALESCE(v_divergencias, '[]'::jsonb),
        'auditoria_transacoes', COALESCE(v_auditoria, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_financial_report FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_report TO authenticated;


--- SPRINT 5: CORREÇÃO DE RPCS FINANCEIRAS ---
-- Migration 13: Triggers, RLS and RPCs for Sprint 5 (Financial System)

-- 1. TRIGGERS DE UPDATED_AT
DROP TRIGGER IF EXISTS trg_set_updated_at_financial_categories ON public.financial_categories;
CREATE TRIGGER trg_set_updated_at_financial_categories BEFORE UPDATE ON public.financial_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_cash_registers ON public.cash_registers;
CREATE TRIGGER trg_set_updated_at_cash_registers BEFORE UPDATE ON public.cash_registers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_financial_transactions ON public.financial_transactions;
CREATE TRIGGER trg_set_updated_at_financial_transactions BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_accounts_receivable ON public.accounts_receivable;
CREATE TRIGGER trg_set_updated_at_accounts_receivable BEFORE UPDATE ON public.accounts_receivable FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_accounts_payable ON public.accounts_payable;
CREATE TRIGGER trg_set_updated_at_accounts_payable BEFORE UPDATE ON public.accounts_payable FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_account_payable_payments ON public.account_payable_payments;
CREATE TRIGGER trg_set_updated_at_account_payable_payments BEFORE UPDATE ON public.account_payable_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at_commissions ON public.commissions;
CREATE TRIGGER trg_set_updated_at_commissions BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2. VALIDAÇÃO CROSS-TENANT EM TRIGGER
CREATE OR REPLACE FUNCTION public.validate_cross_tenant_sprint5()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'cash_movements' THEN
        IF NOT EXISTS (SELECT 1 FROM public.cash_registers cr WHERE cr.id = NEW.cash_register_id AND cr.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: O caixa pertence a outra organização.';
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'financial_transactions' THEN
        IF NEW.category_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.financial_categories fc WHERE fc.id = NEW.category_id AND fc.organization_id = NEW.organization_id) THEN
                RAISE EXCEPTION 'Cross-tenant error: A categoria financeira pertence a outra organização.';
            END IF;
        END IF;
        IF NEW.payment_method_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.payment_methods pm WHERE pm.id = NEW.payment_method_id AND pm.organization_id = NEW.organization_id) THEN
                RAISE EXCEPTION 'Cross-tenant error: A forma de pagamento pertence a outra organização.';
            END IF;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'accounts_receivable' THEN
        IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: O cliente pertence a outra organização.';
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'accounts_payable' THEN
        IF NEW.category_id IS NOT NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.financial_categories fc WHERE fc.id = NEW.category_id AND fc.organization_id = NEW.organization_id) THEN
                RAISE EXCEPTION 'Cross-tenant error: A categoria financeira pertence a outra organização.';
            END IF;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'commissions' THEN
        IF NOT EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = NEW.professional_id AND p.organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'Cross-tenant error: O profissional pertence a outra organização.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_val_cross_tenant_cash_movements ON public.cash_movements;
CREATE TRIGGER trg_val_cross_tenant_cash_movements BEFORE INSERT OR UPDATE ON public.cash_movements FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint5();

DROP TRIGGER IF EXISTS trg_val_cross_tenant_fin_tx ON public.financial_transactions;
CREATE TRIGGER trg_val_cross_tenant_fin_tx BEFORE INSERT OR UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint5();

DROP TRIGGER IF EXISTS trg_val_cross_tenant_acc_rec ON public.accounts_receivable;
CREATE TRIGGER trg_val_cross_tenant_acc_rec BEFORE INSERT OR UPDATE ON public.accounts_receivable FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint5();

DROP TRIGGER IF EXISTS trg_val_cross_tenant_acc_pay ON public.accounts_payable;
CREATE TRIGGER trg_val_cross_tenant_acc_pay BEFORE INSERT OR UPDATE ON public.accounts_payable FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint5();

DROP TRIGGER IF EXISTS trg_val_cross_tenant_comm ON public.commissions;
CREATE TRIGGER trg_val_cross_tenant_comm BEFORE INSERT OR UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.validate_cross_tenant_sprint5();


-- 3. FUNCTION DE POPULAÇÃO DE CATEGORIAS FINANCEIRAS PADRÃO (SEEDING)
CREATE OR REPLACE FUNCTION public.seed_default_financial_categories(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Receitas Padrão
    INSERT INTO public.financial_categories (organization_id, name, type, is_system, is_active)
    VALUES
        (p_org_id, 'Atendimentos', 'income', TRUE, TRUE),
        (p_org_id, 'Venda de Pacotes', 'income', TRUE, TRUE),
        (p_org_id, 'Receita Manual', 'income', FALSE, TRUE),
        (p_org_id, 'Outros Recebimentos', 'income', FALSE, TRUE)
    ON CONFLICT (organization_id, name, type) DO NOTHING;

    -- Despesas Padrão
    INSERT INTO public.financial_categories (organization_id, name, type, is_system, is_active)
    VALUES
        (p_org_id, 'Comissão de Profissionais', 'expense', TRUE, TRUE),
        (p_org_id, 'Aluguel', 'expense', FALSE, TRUE),
        (p_org_id, 'Produtos e Insumos', 'expense', FALSE, TRUE),
        (p_org_id, 'Água / Luz / Telefone', 'expense', FALSE, TRUE),
        (p_org_id, 'Marketing', 'expense', FALSE, TRUE),
        (p_org_id, 'Despesa Manual', 'expense', FALSE, TRUE),
        (p_org_id, 'Outras Despesas', 'expense', FALSE, TRUE)
    ON CONFLICT (organization_id, name, type) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 4. RLS E POLÍTICAS DE SEGURANÇA DA SPRINT 5
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_payable_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_items ENABLE ROW LEVEL SECURITY;

-- FINANCIAL_CATEGORIES
DROP POLICY IF EXISTS "RLS Select financial_categories" ON public.financial_categories;
CREATE POLICY "RLS Select financial_categories" ON public.financial_categories FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage financial_categories" ON public.financial_categories;
CREATE POLICY "RLS Manage financial_categories" ON public.financial_categories FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));

-- CASH_REGISTERS
DROP POLICY IF EXISTS "RLS Select cash_registers" ON public.cash_registers;
CREATE POLICY "RLS Select cash_registers" ON public.cash_registers FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage cash_registers" ON public.cash_registers;
CREATE POLICY "RLS Manage cash_registers" ON public.cash_registers FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin', 'receptionist']));

-- CASH_MOVEMENTS
DROP POLICY IF EXISTS "RLS Select cash_movements" ON public.cash_movements;
CREATE POLICY "RLS Select cash_movements" ON public.cash_movements FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage cash_movements" ON public.cash_movements;
CREATE POLICY "RLS Manage cash_movements" ON public.cash_movements FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin', 'receptionist']));

-- FINANCIAL_TRANSACTIONS
DROP POLICY IF EXISTS "RLS Select financial_transactions" ON public.financial_transactions;
CREATE POLICY "RLS Select financial_transactions" ON public.financial_transactions FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage financial_transactions" ON public.financial_transactions;
CREATE POLICY "RLS Manage financial_transactions" ON public.financial_transactions FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin', 'receptionist']));

-- ACCOUNTS_RECEIVABLE
DROP POLICY IF EXISTS "RLS Select accounts_receivable" ON public.accounts_receivable;
CREATE POLICY "RLS Select accounts_receivable" ON public.accounts_receivable FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage accounts_receivable" ON public.accounts_receivable;
CREATE POLICY "RLS Manage accounts_receivable" ON public.accounts_receivable FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin', 'receptionist']));

-- ACCOUNTS_PAYABLE
DROP POLICY IF EXISTS "RLS Select accounts_payable" ON public.accounts_payable;
CREATE POLICY "RLS Select accounts_payable" ON public.accounts_payable FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage accounts_payable" ON public.accounts_payable;
CREATE POLICY "RLS Manage accounts_payable" ON public.accounts_payable FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));

-- ACCOUNT_PAYABLE_PAYMENTS
DROP POLICY IF EXISTS "RLS Select account_payable_payments" ON public.account_payable_payments;
CREATE POLICY "RLS Select account_payable_payments" ON public.account_payable_payments FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage account_payable_payments" ON public.account_payable_payments;
CREATE POLICY "RLS Manage account_payable_payments" ON public.account_payable_payments FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));

-- COMMISSIONS
DROP POLICY IF EXISTS "RLS Select commissions" ON public.commissions;
CREATE POLICY "RLS Select commissions" ON public.commissions FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage commissions" ON public.commissions;
CREATE POLICY "RLS Manage commissions" ON public.commissions FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));

-- COMMISSION_ITEMS
DROP POLICY IF EXISTS "RLS Select commission_items" ON public.commission_items;
CREATE POLICY "RLS Select commission_items" ON public.commission_items FOR SELECT USING (public.user_belongs_to_org(organization_id));

DROP POLICY IF EXISTS "RLS Manage commission_items" ON public.commission_items;
CREATE POLICY "RLS Manage commission_items" ON public.commission_items FOR ALL USING (public.user_has_org_role(organization_id, ARRAY['owner', 'admin']));


-- 5. RPC DE ABERTURA DE CAIXA (OPEN_CASH_REGISTER)
CREATE OR REPLACE FUNCTION public.open_cash_register(p_opening_balance NUMERIC, p_org_id UUID)
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
    IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin', 'receptionist') THEN
        RAISE EXCEPTION 'Acesso negado: Permissão insuficiente para abrir caixa.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.cash_registers WHERE organization_id = p_org_id AND status = 'open') THEN
        RAISE EXCEPTION 'Erro: Já existe um caixa aberto para esta organização.';
    END IF;

    IF p_opening_balance < 0 THEN RAISE EXCEPTION 'Erro: O saldo de abertura não pode ser negativo.'; END IF;

    -- Popular categorias padrão se ainda não existirem
    PERFORM public.seed_default_financial_categories(p_org_id);

    INSERT INTO public.cash_registers (
        organization_id, opened_at, opened_by, opening_balance, status
    ) VALUES (
        p_org_id, NOW(), v_user_id, p_opening_balance, 'open'
    ) RETURNING id INTO v_cash_reg_id;

    -- Inserir movimento físico inicial em cash_movements
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


-- 6. RPC DE FECHAMENTO DE CAIXA (CLOSE_CASH_REGISTER)
CREATE OR REPLACE FUNCTION public.close_cash_register(p_cash_register_id UUID, p_actual_closing_balance NUMERIC, p_notes TEXT DEFAULT NULL)
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
    IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin', 'receptionist') THEN
        RAISE EXCEPTION 'Acesso negado: Permissão insuficiente para fechar caixa.';
    END IF;

    IF v_cr.status = 'closed' THEN RAISE EXCEPTION 'Erro: Este caixa já foi fechado anteriormente e é imutável.'; END IF;

    -- Somar exclusivamente movimentações físicas registradas em cash_movements
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
    WHERE id = p_cash_register_id;

    IF v_diff != 0 THEN
        INSERT INTO public.cash_movements (
            organization_id, cash_register_id, type, amount, description, created_by
        ) VALUES (
            v_cr.organization_id, p_cash_register_id, 'closing_adjustment', v_diff, 'Ajuste de Divergência no Fechamento de Caixa', v_user_id
        );
    END IF;

    SELECT jsonb_build_object(
        'id', id,
        'organization_id', organization_id,
        'opened_at', opened_at,
        'closed_at', closed_at,
        'opening_balance', opening_balance,
        'closing_balance', closing_balance,
        'expected_balance', expected_balance,
        'difference', difference,
        'status', status
    ) INTO v_result FROM public.cash_registers WHERE cash_registers.id = p_cash_register_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 7. RPC DE MOVIMENTAÇÃO DE CAIXA (SANGRIA / SUPRIMENTO)
CREATE OR REPLACE FUNCTION public.add_cash_movement(p_type TEXT, p_amount NUMERIC, p_description TEXT, p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_cr RECORD;
    v_mov_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.'; END IF;

    IF p_type NOT IN ('supply', 'withdrawal') THEN
        RAISE EXCEPTION 'Erro: Tipo de movimentação inválido. Utilize supply (suprimento) ou withdrawal (sangria).';
    END IF;

    IF p_amount <= 0 THEN RAISE EXCEPTION 'Erro: O valor da movimentação deve ser maior que 0.'; END IF;

    SELECT * INTO v_cr FROM public.cash_registers WHERE organization_id = p_org_id AND status = 'open' FOR UPDATE;
    IF v_cr.id IS NULL THEN
        RAISE EXCEPTION 'Erro: Não existe caixa físico aberto para registrar sangrias ou suprimentos.';
    END IF;

    INSERT INTO public.cash_movements (
        organization_id, cash_register_id, type, amount, description, created_by
    ) VALUES (
        p_org_id, v_cr.id, p_type, p_amount, p_description, v_user_id
    ) RETURNING id INTO v_mov_id;

    RETURN jsonb_build_object('success', true, 'id', v_mov_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 8. RPC DE BAIXA TRANSACIONAL EM CONTAS A RECEBER (PAY_ACCOUNT_RECEIVABLE)
CREATE OR REPLACE FUNCTION public.pay_account_receivable(p_account_receivable_id UUID, p_amount NUMERIC, p_payment_method_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_ar RECORD;
    v_pm RECORD;
    v_cr RECORD;
    v_org_id UUID;
    v_new_paid NUMERIC(12,2);
    v_new_rem NUMERIC(12,2);
    v_status TEXT;
    v_tx_id UUID;
    v_cat_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.'; END IF;

    SELECT * INTO v_ar FROM public.accounts_receivable WHERE accounts_receivable.id = p_account_receivable_id FOR UPDATE;
    IF v_ar.id IS NULL THEN RAISE EXCEPTION 'Erro: Conta a receber não encontrada.'; END IF;
    v_org_id := v_ar.organization_id;

    SELECT role INTO v_user_role FROM public.organization_users WHERE organization_id = v_org_id AND user_id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin', 'receptionist') THEN
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

    -- Se for pagamento em espécie (dinheiro), exigir caixa aberto
    IF v_pm.type = 'cash' THEN
        SELECT * INTO v_cr FROM public.cash_registers WHERE organization_id = v_org_id AND status = 'open';
        IF v_cr.id IS NULL THEN
            RAISE EXCEPTION 'Erro: Para recebimentos em dinheiro (espécie), o caixa físico da organização precisa estar aberto.';
        END IF;
    END IF;

    v_new_paid := v_ar.paid_amount + p_amount;
    v_new_rem := v_ar.remaining_amount - p_amount;
    IF v_new_rem <= 0 THEN v_status := 'paid'; ELSE v_status := 'partial'; END IF;

    -- Atualizar Accounts Receivable
    UPDATE public.accounts_receivable SET
        paid_amount = v_new_paid,
        remaining_amount = v_new_rem,
        status = v_status,
        updated_at = NOW()
    WHERE id = p_account_receivable_id;

    -- Atualizar Fonte de Origem (Appointment ou ClientPackage)
    IF v_ar.appointment_id IS NOT NULL THEN
        INSERT INTO public.appointment_payments (
            organization_id, appointment_id, payment_method_id, amount, paid_at
        ) VALUES (
            v_org_id, v_ar.appointment_id, p_payment_method_id, p_amount, NOW()
        );

        UPDATE public.appointments SET
            payment_status = CASE WHEN v_new_rem <= 0 THEN 'paid' ELSE 'partial' END,
            updated_at = NOW()
        WHERE appointments.id = v_ar.appointment_id;

        SELECT financial_categories.id INTO v_cat_id FROM public.financial_categories WHERE financial_categories.organization_id = v_org_id AND financial_categories.name = 'Atendimentos' AND financial_categories.type = 'income' LIMIT 1;
    ELSIF v_ar.client_package_id IS NOT NULL THEN
        INSERT INTO public.client_package_payments (
            organization_id, client_package_id, payment_method_id, amount, paid_at
        ) VALUES (
            v_org_id, v_ar.client_package_id, p_payment_method_id, p_amount, NOW()
        );

        UPDATE public.client_packages SET
            amount_paid = amount_paid + p_amount,
            payment_status = CASE WHEN v_new_rem <= 0 THEN 'paid' ELSE 'partial' END,
            updated_at = NOW()
        WHERE client_packages.id = v_ar.client_package_id;

        SELECT financial_categories.id INTO v_cat_id FROM public.financial_categories WHERE financial_categories.organization_id = v_org_id AND financial_categories.name = 'Venda de Pacotes' AND financial_categories.type = 'income' LIMIT 1;
    END IF;

    -- Inserir Transação em financial_transactions
    INSERT INTO public.financial_transactions (
        organization_id, cash_register_id, category_id, type, amount, payment_method_id,
        description, transaction_date, source_type, source_id, appointment_id, client_package_id, created_by
    ) VALUES (
        v_org_id, v_cr.id, v_cat_id, 'income', p_amount, p_payment_method_id,
        'Recebimento de Conta a Receber - ' || COALESCE(v_ar.description, 'Cliente'), NOW(),
        'receivable_payment', p_account_receivable_id, v_ar.appointment_id, v_ar.client_package_id, v_user_id
    ) RETURNING id INTO v_tx_id;

    -- Se dinheiro físico e caixa aberto, gravar cash_movement
    IF v_pm.type = 'cash' AND v_cr.id IS NOT NULL THEN
        INSERT INTO public.cash_movements (
            organization_id, cash_register_id, type, amount, description, financial_transaction_id, created_by
        ) VALUES (
            v_org_id, v_cr.id, 'receipt', p_amount, 'Recebimento de Conta a Receber (Espécie)', v_tx_id, v_user_id
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'id', p_account_receivable_id, 'remaining_amount', v_new_rem, 'status', v_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 9. RPC DE BAIXA EM CONTAS A PAGAR (PAY_ACCOUNT_PAYABLE)
CREATE OR REPLACE FUNCTION public.pay_account_payable(p_account_payable_id UUID, p_amount NUMERIC, p_payment_method_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_ap RECORD;
    v_pm RECORD;
    v_cr RECORD;
    v_org_id UUID;
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
    IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Acesso negado: Somente proprietários e administradores podem quitar contas a pagar.';
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
    WHERE id = p_account_payable_id;

    INSERT INTO public.account_payable_payments (
        organization_id, account_payable_id, payment_method_id, amount, paid_at, created_by
    ) VALUES (
        v_org_id, p_account_payable_id, p_payment_method_id, p_amount, NOW(), v_user_id
    );

    INSERT INTO public.financial_transactions (
        organization_id, cash_register_id, category_id, type, amount, payment_method_id,
        description, transaction_date, source_type, source_id, created_by
    ) VALUES (
        v_org_id, v_cr.id, v_ap.category_id, 'expense', p_amount, p_payment_method_id,
        'Pagamento de Conta a Pagar - ' || v_ap.description, NOW(),
        'payable_payment', p_account_payable_id, v_user_id
    ) RETURNING id INTO v_tx_id;

    IF v_pm.type = 'cash' AND v_cr.id IS NOT NULL THEN
        INSERT INTO public.cash_movements (
            organization_id, cash_register_id, type, amount, description, financial_transaction_id, created_by
        ) VALUES (
            v_org_id, v_cr.id, 'expense', p_amount, 'Pagamento de Despesa (Espécie): ' || v_ap.description, v_tx_id, v_user_id
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'id', p_account_payable_id, 'remaining_amount', v_new_rem, 'status', v_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 10. ATUALIZAÇÃO EM COMPLETE_APPOINTMENT PARA GERAR ACCOUNTS_RECEIVABLE E FINANCIAL_TRANSACTIONS
-- Atualizar a RPC de conclusão para gravar accounts_receivable e financial_transactions sem duplicatas
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
    v_pm_id UUID;
    v_pm_type TEXT;
    v_pay_amt NUMERIC(12,2);
    v_app_pay_id UUID;
    v_tx_id UUID;
    v_finished_at TIMESTAMPTZ := NOW();
    v_result JSONB;

    v_cp RECORD;
    v_cpi RECORD;
    v_cpr RECORD;
    v_cr RECORD;
    v_cat_id UUID;
    v_period_start TIMESTAMPTZ;
    v_used_count INT := 0;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.'; END IF;

    v_org_id := (p_data->>'organization_id')::UUID;
    v_client_id := (p_data->>'client_id')::UUID;
    v_main_prof_id := (p_data->>'professional_id')::UUID;

    IF NOT public.user_belongs_to_org(v_org_id) THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não pertence a esta organização.';
    END IF;

    SELECT role INTO v_user_role FROM public.organization_users WHERE organization_id = v_org_id AND user_id = v_user_id AND is_active = TRUE;
    IF v_user_role IS NULL THEN RAISE EXCEPTION 'Acesso negado: Perfil do usuário não encontrado nesta organização.'; END IF;

    IF v_user_role = 'professional' THEN
        SELECT professionals.id INTO v_linked_prof_id FROM public.professionals WHERE professionals.user_id = v_user_id AND professionals.organization_id = v_org_id AND professionals.is_active = TRUE;
        IF v_linked_prof_id IS NULL THEN RAISE EXCEPTION 'Acesso negado: O usuário não possui cadastro de profissional ativo.'; END IF;
        v_main_prof_id := v_linked_prof_id;
    END IF;

    IF p_data->'services' IS NULL OR jsonb_array_length(p_data->'services') = 0 THEN
        RAISE EXCEPTION 'Erro: Informe ao menos 1 serviço para concluir o atendimento.';
    END IF;

    SELECT COALESCE(timezone, 'America/Sao_Paulo'), COALESCE(allow_package_usage_with_pending_balance, TRUE)
    INTO v_tz, v_allow_pending_pkg FROM public.organizations WHERE organizations.id = v_org_id;

    v_op_date := (v_finished_at AT TIME ZONE v_tz)::DATE;

    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE clients.id = v_client_id AND clients.organization_id = v_org_id AND clients.is_active = TRUE) THEN
        RAISE EXCEPTION 'Erro: Cliente inválido ou inativo nesta organização.';
    END IF;

    IF p_data->>'appointment_id' IS NOT NULL THEN
        v_app_id := (p_data->>'appointment_id')::UUID;
        SELECT status INTO v_curr_status FROM public.appointments WHERE appointments.id = v_app_id AND appointments.organization_id = v_org_id;

        IF v_curr_status IS NULL THEN RAISE EXCEPTION 'Erro: Atendimento informado não foi encontrado.'; END IF;
        IF v_curr_status = 'completed' THEN RAISE EXCEPTION 'Erro: Este atendimento já foi concluído anteriormente.'; END IF;
        IF v_curr_status = 'cancelled' THEN RAISE EXCEPTION 'Erro: Não é possível concluir atendimento cancelado.'; END IF;

        UPDATE public.appointments SET client_id = v_client_id, professional_id = v_main_prof_id, notes = p_data->>'notes', updated_at = NOW()
        WHERE id = v_app_id AND organization_id = v_org_id;
    ELSE
        INSERT INTO public.appointments (
            organization_id, client_id, professional_id, appointment_date, finished_at, status, notes, created_by
        ) VALUES (
            v_org_id, v_client_id, v_main_prof_id, v_op_date, v_finished_at, 'draft', p_data->>'notes', v_user_id
        ) RETURNING id INTO v_app_id;
    END IF;

    DELETE FROM public.package_usages WHERE appointment_id = v_app_id AND organization_id = v_org_id;
    DELETE FROM public.appointment_services WHERE appointment_id = v_app_id AND organization_id = v_org_id;
    DELETE FROM public.appointment_payments WHERE appointment_id = v_app_id AND organization_id = v_org_id;

    -- Processar Serviços
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'services') LOOP
        v_svc_id := (v_item->>'service_id')::UUID;
        v_svc_prof_id := COALESCE((v_item->>'professional_id')::UUID, v_main_prof_id);
        v_qty := COALESCE((v_item->>'quantity')::INT, 1);
        v_svc_disc := COALESCE((v_item->>'discount')::NUMERIC, 0.00);
        v_client_pkg_id := (v_item->>'client_package_id')::UUID;
        v_item_pkg_covered := 0.00;

        SELECT price, counts_for_return_frequency INTO v_svc_price, v_counts_ret FROM public.services WHERE services.id = v_svc_id AND services.organization_id = v_org_id AND services.is_active = TRUE;

        IF v_svc_prof_id IS NOT NULL THEN
            SELECT COALESCE(custom_price, v_svc_price) INTO v_svc_price FROM public.professional_services WHERE professional_id = v_svc_prof_id AND service_id = v_svc_id AND organization_id = v_org_id;
        END IF;

        v_svc_tot := (v_qty * v_svc_price) - v_svc_disc;

        IF v_client_pkg_id IS NOT NULL THEN
            SELECT * INTO v_cp FROM public.client_packages WHERE client_packages.id = v_client_pkg_id AND client_packages.client_id = v_client_id AND client_packages.organization_id = v_org_id FOR UPDATE;
            IF v_cp.id IS NULL OR v_cp.status != 'active' OR v_cp.expires_at < NOW() THEN
                RAISE EXCEPTION 'Erro: O pacote selecionado é inválido, inativo ou já venceu.';
            END IF;

            SELECT * INTO v_cpr FROM public.client_package_rules WHERE client_package_id = v_client_pkg_id AND (service_id = v_svc_id OR service_id IS NULL) ORDER BY service_id DESC NULLS LAST LIMIT 1 FOR UPDATE;
            SELECT * INTO v_cpi FROM public.client_package_items WHERE client_package_id = v_client_pkg_id AND service_id = v_svc_id FOR UPDATE;

            IF v_cpr.rule_type = 'service_credit' THEN
                IF v_cpi.id IS NULL OR v_cpi.remaining_quantity < v_qty THEN
                    RAISE EXCEPTION 'Erro: Saldo de créditos insuficiente para o serviço no pacote.';
                END IF;
                UPDATE public.client_package_items SET used_quantity = used_quantity + v_qty, remaining_quantity = remaining_quantity - v_qty, updated_at = NOW() WHERE client_package_items.id = v_cpi.id;
            END IF;

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

        IF v_client_pkg_id IS NOT NULL THEN
            INSERT INTO public.package_usages (
                organization_id, client_package_id, client_package_item_id, client_package_rule_id, appointment_id, appointment_service_id, service_id, professional_id, quantity, used_at, created_by
            ) VALUES (
                v_org_id, v_client_pkg_id, v_cpi.id, v_cpr.id, v_app_id, v_app_svc_id, v_svc_id, v_svc_prof_id, v_qty, NOW(), v_user_id
            );
        END IF;
    END LOOP;

    v_total := v_subtotal - v_discount;
    v_amount_due := GREATEST(0.00, v_total - v_pkg_covered_total);

    SELECT financial_categories.id INTO v_cat_id FROM public.financial_categories WHERE financial_categories.organization_id = v_org_id AND financial_categories.name = 'Atendimentos' AND financial_categories.type = 'income' LIMIT 1;

    -- Processar Pagamentos e Exigência de Caixa Aberto para Dinheiro (Espécie)
    IF p_data->'payments' IS NOT NULL AND jsonb_array_length(p_data->'payments') > 0 THEN
        FOR v_payment IN SELECT * FROM jsonb_array_elements(p_data->'payments') LOOP
            v_pay_amt := (v_payment->>'amount')::NUMERIC;
            v_pm_id := (v_payment->>'payment_method_id')::UUID;

            SELECT type INTO v_pm_type FROM public.payment_methods WHERE payment_methods.id = v_pm_id AND payment_methods.organization_id = v_org_id AND payment_methods.is_active = TRUE;
            IF v_pm_type IS NULL THEN RAISE EXCEPTION 'Erro: Forma de pagamento inválida.'; END IF;

            IF v_pm_type = 'cash' THEN
                SELECT * INTO v_cr FROM public.cash_registers WHERE organization_id = v_org_id AND status = 'open';
                IF v_cr.id IS NULL THEN
                    RAISE EXCEPTION 'Erro: Para pagamentos em dinheiro (espécie), o caixa físico da organização precisa estar aberto.';
                END IF;
            END IF;

            INSERT INTO public.appointment_payments (
                organization_id, appointment_id, payment_method_id, amount, installments, notes, paid_at
            ) VALUES (
                v_org_id, v_app_id, v_pm_id, v_pay_amt, COALESCE((v_payment->>'installments')::INT, 1), v_payment->>'notes', NOW()
            ) RETURNING id INTO v_app_pay_id;

            v_pay_total := v_pay_total + v_pay_amt;

            -- Inserir em financial_transactions
            INSERT INTO public.financial_transactions (
                organization_id, cash_register_id, category_id, type, amount, payment_method_id,
                description, transaction_date, source_type, source_id, appointment_id, created_by
            ) VALUES (
                v_org_id, v_cr.id, v_cat_id, 'income', v_pay_amt, v_pm_id,
                'Pagamento de Atendimento', NOW(), 'appointment_payment', v_app_pay_id, v_app_id, v_user_id
            ) RETURNING id INTO v_tx_id;

            IF v_pm_type = 'cash' AND v_cr.id IS NOT NULL THEN
                INSERT INTO public.cash_movements (
                    organization_id, cash_register_id, type, amount, description, financial_transaction_id, created_by
                ) VALUES (
                    v_org_id, v_cr.id, 'sale', v_pay_amt, 'Recebimento de Atendimento (Espécie)', v_tx_id, v_user_id
                );
            END IF;
        END LOOP;
    END IF;

    IF v_pay_total > v_amount_due THEN RAISE EXCEPTION 'Erro: Pagamento maior que valor devido.'; END IF;

    IF v_pay_total >= v_amount_due THEN v_pay_status := 'paid'; ELSIF v_pay_total > 0 THEN v_pay_status := 'partial'; ELSE v_pay_status := 'pending'; END IF;

    UPDATE public.appointments SET
        subtotal = v_subtotal, discount = v_discount, total = v_total,
        package_covered_amount = v_pkg_covered_total, amount_due = v_amount_due,
        payment_status = v_pay_status, status = 'completed', finished_at = v_finished_at, updated_at = NOW()
    WHERE id = v_app_id AND organization_id = v_org_id;

    -- Se houver pendência financeira (remaining_amount > 0), gerar Conta a Receber automaticamente
    IF (v_amount_due - v_pay_total) > 0 THEN
        INSERT INTO public.accounts_receivable (
            organization_id, client_id, appointment_id, description, original_amount, paid_amount, remaining_amount, due_date, status
        ) VALUES (
            v_org_id, v_client_id, v_app_id, 'Saldo Pendente de Atendimento', v_amount_due, v_pay_total, (v_amount_due - v_pay_total), v_op_date, v_pay_status
        );
    END IF;

    PERFORM public.recalculate_client_metrics(v_client_id, v_org_id);

    FOR v_svc_id IN SELECT DISTINCT service_id FROM public.appointment_services WHERE appointment_id = v_app_id AND counts_for_return_frequency = TRUE LOOP
        PERFORM public.recalculate_client_service_frequency(v_client_id, v_svc_id, v_org_id);
    END LOOP;

    SELECT jsonb_build_object(
        'id', id, 'organization_id', organization_id, 'client_id', client_id,
        'subtotal', subtotal, 'discount', discount, 'total', total,
        'package_covered_amount', package_covered_amount, 'amount_due', amount_due,
        'payment_status', payment_status, 'status', status
    ) INTO v_result FROM public.appointments WHERE appointments.id = v_app_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 11. RPC DE APURAÇÃO DE COMISSÕES DE PROFISSIONAIS (CALCULATE_PROFESSIONAL_COMMISSIONS)
CREATE OR REPLACE FUNCTION public.calculate_professional_commissions(p_org_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS JSONB AS $$
DECLARE
    v_prof RECORD;
    v_svc RECORD;
    v_comm_id UUID;
    v_total_prod NUMERIC(12,2) := 0.00;
    v_total_comm NUMERIC(12,2) := 0.00;
    v_item_comm NUMERIC(12,2) := 0.00;
    v_rate NUMERIC(12,2) := 0.00;
    v_count INT := 0;
BEGIN
    FOR v_prof IN SELECT * FROM public.professionals WHERE organization_id = p_org_id AND is_active = TRUE LOOP
        v_total_prod := 0.00;
        v_total_comm := 0.00;

        -- Buscar itens de serviços concluídos não apurados
        FOR v_svc IN
            SELECT aps.id AS app_svc_id, aps.total AS prod_total, aps.commission_amount AS item_comm, p.commission_type, p.commission_value
            FROM public.appointment_services aps
            JOIN public.appointments a ON a.id = aps.appointment_id
            JOIN public.professionals p ON p.id = aps.professional_id
            WHERE aps.organization_id = p_org_id
              AND aps.professional_id = v_prof.id
              AND a.status = 'completed'
              AND a.appointment_date BETWEEN p_start_date AND p_end_date
              AND NOT EXISTS (SELECT 1 FROM public.commission_items ci WHERE ci.appointment_service_id = aps.id)
        LOOP
            v_total_prod := v_total_prod + v_svc.prod_total;

            IF v_svc.item_comm > 0 THEN
                v_item_comm := v_svc.item_comm;
            ELSIF v_svc.commission_type = 'percentage' THEN
                v_item_comm := ROUND(v_svc.prod_total * (v_svc.commission_value / 100.00), 2);
            ELSIF v_svc.commission_type = 'fixed' THEN
                v_item_comm := v_svc.commission_value;
            ELSE
                v_item_comm := 0.00;
            END IF;

            v_total_comm := v_total_comm + v_item_comm;
        END LOOP;

        IF v_total_prod > 0 THEN
            INSERT INTO public.commissions (
                organization_id, professional_id, period_start, period_end, production_total, commission_amount, status
            ) VALUES (
                p_org_id, v_prof.id, p_start_date, p_end_date, v_total_prod, v_total_comm, 'calculated'
            ) RETURNING id INTO v_comm_id;

            -- Inserir detalhamento em commission_items
            FOR v_svc IN
                SELECT aps.id AS app_svc_id, aps.total AS prod_total, aps.commission_amount AS item_comm, p.commission_type, p.commission_value
                FROM public.appointment_services aps
                JOIN public.appointments a ON a.id = aps.appointment_id
                JOIN public.professionals p ON p.id = aps.professional_id
                WHERE aps.organization_id = p_org_id
                  AND aps.professional_id = v_prof.id
                  AND a.status = 'completed'
                  AND a.appointment_date BETWEEN p_start_date AND p_end_date
                  AND NOT EXISTS (SELECT 1 FROM public.commission_items ci WHERE ci.appointment_service_id = aps.id)
            LOOP
                IF v_svc.item_comm > 0 THEN
                    v_item_comm := v_svc.item_comm;
                ELSIF v_svc.commission_type = 'percentage' THEN
                    v_item_comm := ROUND(v_svc.prod_total * (v_svc.commission_value / 100.00), 2);
                ELSIF v_svc.commission_type = 'fixed' THEN
                    v_item_comm := v_svc.commission_value;
                ELSE
                    v_item_comm := 0.00;
                END IF;

                INSERT INTO public.commission_items (
                    organization_id, commission_id, appointment_service_id, professional_id, production_amount, commission_amount
                ) VALUES (
                    p_org_id, v_comm_id, v_svc.app_svc_id, v_prof.id, v_svc.prod_total, v_item_comm
                );
            END LOOP;

            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'commissions_created', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 12. RPC DE APROVAÇÃO E GERAÇÃO DE CONTA A PAGAR DA COMISSÃO
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
    IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Acesso negado: Somente administradores podem aprovar comissões.';
    END IF;

    IF v_comm.status != 'calculated' THEN
        RAISE EXCEPTION 'Erro: Esta comissão já foi aprovada ou quitada anteriormente.';
    END IF;

    SELECT * INTO v_prof FROM public.professionals WHERE professionals.id = v_comm.professional_id;
    SELECT financial_categories.id INTO v_cat_id FROM public.financial_categories WHERE financial_categories.organization_id = v_comm.organization_id AND financial_categories.name = 'Comissão de Profissionais' AND financial_categories.type = 'expense' LIMIT 1;

    -- Gerar Conta a Pagar sob a categoria Comissão
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


-- 13. SCRIPT DE BACKFILL IDEMPOTENTE DE PAGAMENTOS HISTÓRICOS EM FINANCIAL_TRANSACTIONS
CREATE OR REPLACE FUNCTION public.backfill_financial_transactions(p_org_id UUID)
RETURNS VOID AS $$
DECLARE
    v_cat_app UUID;
    v_cat_pkg UUID;
BEGIN
    SELECT financial_categories.id INTO v_cat_app FROM public.financial_categories WHERE financial_categories.organization_id = p_org_id AND financial_categories.name = 'Atendimentos' AND financial_categories.type = 'income' LIMIT 1;
    SELECT financial_categories.id INTO v_cat_pkg FROM public.financial_categories WHERE financial_categories.organization_id = p_org_id AND financial_categories.name = 'Venda de Pacotes' AND financial_categories.type = 'income' LIMIT 1;

    -- Backfill de appointment_payments
    INSERT INTO public.financial_transactions (
        organization_id, category_id, type, amount, payment_method_id, description, transaction_date, source_type, source_id, appointment_id
    )
    SELECT
        ap.organization_id, v_cat_app, 'income', ap.amount, ap.payment_method_id,
        'Pagamento de Atendimento (Histórico)', ap.paid_at, 'appointment_payment', ap.id, ap.appointment_id
    FROM public.appointment_payments ap
    WHERE ap.organization_id = p_org_id AND ap.voided_at IS NULL
    ON CONFLICT (organization_id, source_type, source_id) DO NOTHING;

    -- Backfill de client_package_payments
    INSERT INTO public.financial_transactions (
        organization_id, category_id, type, amount, payment_method_id, description, transaction_date, source_type, source_id, client_package_id
    )
    SELECT
        cpp.organization_id, v_cat_pkg, 'income', cpp.amount, cpp.payment_method_id,
        'Venda de Pacote/Plano (Histórico)', cpp.paid_at, 'client_package_payment', cpp.id, cpp.client_package_id
    FROM public.client_package_payments cpp
    WHERE cpp.organization_id = p_org_id AND cpp.voided_at IS NULL
    ON CONFLICT (organization_id, source_type, source_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


--- SPRINT 4: CORREÇÃO DE RPCS DE PACOTES ---
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
    WHERE id = v_client_pkg_id;

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
        WHERE id = v_app_id AND organization_id = v_org_id;
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
    WHERE id = v_app_id AND organization_id = v_org_id;

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
    WHERE id = p_appointment_id;

    -- Recalcular métricas do cliente
    PERFORM public.recalculate_client_metrics(v_app.client_id, v_org_id);

    RETURN jsonb_build_object('success', true, 'id', p_appointment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


--- SPRINT 2: CORREÇÃO DE RPCS DE ATENDIMENTOS ---
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
    WHERE clients.id = p_client_id AND clients.organization_id = p_org_id;
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
    WHERE organization_users.organization_id = v_org_id AND organization_users.user_id = v_user_id AND organization_users.is_active = TRUE;

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Perfil do usuário não encontrado nesta organização.';
    END IF;

    -- Se papel for professional, mapear profissionais.user_id = auth.uid()
    IF v_user_role = 'professional' THEN
        SELECT professionals.id INTO v_linked_prof_id
        FROM public.professionals
        WHERE professionals.user_id = v_user_id AND professionals.organization_id = v_org_id AND professionals.is_active = TRUE;

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
    SELECT COALESCE(timezone, 'America/Sao_Paulo') INTO v_tz FROM public.organizations WHERE organizations.id = v_org_id;
    v_op_date := (v_finished_at AT TIME ZONE v_tz)::DATE;

    -- 4. Validar Cliente
    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE clients.id = v_client_id AND clients.organization_id = v_org_id AND clients.is_active = TRUE) THEN
        RAISE EXCEPTION 'Erro: Cliente inválido ou inativo nesta organização.';
    END IF;

    -- 5. Validar Profissional Principal se informado
    IF v_main_prof_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.professionals WHERE professionals.id = v_main_prof_id AND professionals.organization_id = v_org_id AND professionals.is_active = TRUE) THEN
            RAISE EXCEPTION 'Erro: Profissional principal inválido ou inativo nesta organização.';
        END IF;
    END IF;

    -- 6. Validar Estado de Atendimento Existente (se atualização)
    IF p_data->>'appointment_id' IS NOT NULL THEN
        v_app_id := (p_data->>'appointment_id')::UUID;
        SELECT status INTO v_curr_status
        FROM public.appointments
        WHERE appointments.id = v_app_id AND appointments.organization_id = v_org_id;

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
            SELECT 1 FROM public.appointments WHERE appointments.id = v_app_id AND appointments.professional_id != v_linked_prof_id
        ) THEN
            RAISE EXCEPTION 'Acesso negado: Você não pode alterar atendimento de outro profissional.';
        END IF;

        UPDATE public.appointments SET
            client_id = v_client_id,
            professional_id = v_main_prof_id,
            notes = p_data->>'notes',
            updated_at = NOW()
        WHERE appointments.id = v_app_id AND appointments.organization_id = v_org_id;
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
        FROM public.services WHERE services.id = v_svc_id AND services.organization_id = v_org_id AND services.is_active = TRUE;

        IF v_svc_price IS NULL THEN
            RAISE EXCEPTION 'Erro: Serviço inválido ou inativo nesta organização.';
        END IF;

        -- Validar Profissional Ativo do Item
        IF v_svc_prof_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.professionals WHERE professionals.id = v_svc_prof_id AND professionals.organization_id = v_org_id AND professionals.is_active = TRUE
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
                SELECT 1 FROM public.payment_methods WHERE payment_methods.id = (v_payment->>'payment_method_id')::UUID AND payment_methods.organization_id = v_org_id AND payment_methods.is_active = TRUE
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
    WHERE appointments.id = v_app_id AND appointments.organization_id = v_org_id;

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
    FROM public.appointments WHERE appointments.id = p_appointment_id;

    IF v_org_id IS NULL THEN RAISE EXCEPTION 'Atendimento não encontrado.'; END IF;
    IF NOT public.user_belongs_to_org(v_org_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

    SELECT role INTO v_user_role
    FROM public.organization_users
    WHERE organization_id = v_org_id AND user_id = v_user_id AND is_active = TRUE;

    -- Professional não pode cancelar atendimentos já concluídos
    IF v_user_role = 'professional' THEN
        SELECT professionals.id INTO v_linked_prof_id FROM public.professionals WHERE professionals.user_id = v_user_id AND professionals.organization_id = v_org_id AND professionals.is_active = TRUE;
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
    WHERE appointments.id = p_appointment_id AND appointments.organization_id = v_org_id;

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
SELECT organizations.id, 'Dinheiro', 'cash', 1 FROM public.organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO public.payment_methods (organization_id, name, type, sort_order)
SELECT organizations.id, 'PIX', 'pix', 2 FROM public.organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO public.payment_methods (organization_id, name, type, sort_order)
SELECT organizations.id, 'Cartão de Débito', 'debit_card', 3 FROM public.organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO public.payment_methods (organization_id, name, type, sort_order)
SELECT organizations.id, 'Cartão de Crédito', 'credit_card', 4 FROM public.organizations
ON CONFLICT (organization_id, name) DO NOTHING;
