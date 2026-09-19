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
DROP FUNCTION IF EXISTS public.get_executive_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
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
    -- Validar acesso (Somente Admin, Receptionist)
    SELECT out_user_id AS user_id, out_user_role AS user_role, out_professional_id AS professional_id, out_org_timezone AS org_timezone
    INTO v_access FROM public.check_report_access(p_org_id, ARRAY['admin', 'receptionist']);

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

REVOKE EXECUTE ON FUNCTION public.get_executive_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_executive_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;


-- 5. RPC: GET_CLIENT_RETENTION_REPORT
DROP FUNCTION IF EXISTS public.get_client_retention_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_client_retention_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID);
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
    INTO v_access FROM public.check_report_access(p_org_id, ARRAY['admin', 'receptionist']);

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

REVOKE EXECUTE ON FUNCTION public.get_client_retention_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_retention_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) TO authenticated;


-- 6. RPC: GET_SERVICES_REPORT
DROP FUNCTION IF EXISTS public.get_services_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_services_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID);
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
    INTO v_access FROM public.check_report_access(p_org_id, ARRAY['admin', 'receptionist']);
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

REVOKE EXECUTE ON FUNCTION public.get_services_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_services_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) TO authenticated;


-- 7. RPC: GET_PROFESSIONALS_REPORT
DROP FUNCTION IF EXISTS public.get_professionals_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_professionals_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID);
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
    INTO v_access FROM public.check_report_access(p_org_id, ARRAY['admin', 'receptionist', 'professional']);

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

REVOKE EXECUTE ON FUNCTION public.get_professionals_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_professionals_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;


-- 8. RPC: GET_PACKAGES_REPORT
DROP FUNCTION IF EXISTS public.get_packages_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
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
    INTO v_access FROM public.check_report_access(p_org_id, ARRAY['admin', 'receptionist']);

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

REVOKE EXECUTE ON FUNCTION public.get_packages_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_packages_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;


-- 9. RPC: GET_FINANCIAL_REPORT
DROP FUNCTION IF EXISTS public.get_financial_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
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
    -- Acesso RESTRITO a Admin
    SELECT out_user_id AS user_id, out_user_role AS user_role, out_professional_id AS professional_id, out_org_timezone AS org_timezone
    INTO v_access FROM public.check_report_access(p_org_id, ARRAY['admin']);

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

REVOKE EXECUTE ON FUNCTION public.get_financial_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
