-- ================================================================================
-- CABELLOS SAAS — SPRINT 6: RELATÓRIOS E INTELIGÊNCIA GERENCIAL
-- PATCH CORRIGIDO PARA O SCHEMA ATUAL
-- ================================================================================

BEGIN;

-- 1. ÍNDICES
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

-- 2. HELPER DE ACESSO
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

    IF p_org_id IS NULL THEN
        RAISE EXCEPTION 'Organização não informada.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.organizations o
        WHERE o.id = p_org_id
          AND COALESCE(o.is_active, TRUE) = TRUE
          AND COALESCE(o.status, 'active') = 'active'
    ) THEN
        RAISE EXCEPTION 'Organização indisponível ou suspensa.';
    END IF;

    SELECT ou.role
      INTO v_role
    FROM public.organization_users ou
    WHERE ou.user_id = v_user_id
      AND ou.organization_id = p_org_id
      AND ou.is_active = TRUE
    LIMIT 1;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado ao tenant.';
    END IF;

    IF NOT (v_role = ANY(p_required_roles)) THEN
        RAISE EXCEPTION 'Permissão insuficiente para este relatório.';
    END IF;

    SELECT p.id
      INTO v_prof_id
    FROM public.professionals p
    WHERE p.user_id = v_user_id
      AND p.organization_id = p_org_id
      AND p.is_active = TRUE
    LIMIT 1;

    SELECT COALESCE(o.timezone, 'America/Sao_Paulo')
      INTO v_tz
    FROM public.organizations o
    WHERE o.id = p_org_id;

    out_user_id := v_user_id;
    out_user_role := v_role;
    out_professional_id := v_prof_id;
    out_org_timezone := COALESCE(v_tz, 'America/Sao_Paulo');
    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.check_report_access(UUID, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_report_access(UUID, TEXT[]) FROM authenticated;

-- 3. HELPER DE FILTROS
CREATE OR REPLACE FUNCTION public.validate_report_filters(
    p_org_id UUID,
    p_professional_id UUID DEFAULT NULL,
    p_service_id UUID DEFAULT NULL,
    p_client_id UUID DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_package_id UUID DEFAULT NULL,
    p_payment_method_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_professional_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.professionals prof
        WHERE prof.id = p_professional_id AND prof.organization_id = p_org_id
    ) THEN
        RAISE EXCEPTION 'Filtro inválido para o tenant: profissional não pertence à organização.';
    END IF;

    IF p_service_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.services svc
        WHERE svc.id = p_service_id AND svc.organization_id = p_org_id
    ) THEN
        RAISE EXCEPTION 'Filtro inválido para o tenant: serviço não pertence à organização.';
    END IF;

    IF p_client_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.clients cli
        WHERE cli.id = p_client_id AND cli.organization_id = p_org_id
    ) THEN
        RAISE EXCEPTION 'Filtro inválido para o tenant: cliente não pertence à organização.';
    END IF;

    IF p_category_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.service_categories cat
        WHERE cat.id = p_category_id AND cat.organization_id = p_org_id
    ) THEN
        RAISE EXCEPTION 'Filtro inválido para o tenant: categoria não pertence à organização.';
    END IF;

    IF p_package_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.packages pkg
        WHERE pkg.id = p_package_id AND pkg.organization_id = p_org_id
    ) THEN
        RAISE EXCEPTION 'Filtro inválido para o tenant: pacote não pertence à organização.';
    END IF;

    IF p_payment_method_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.payment_methods pm
        WHERE pm.id = p_payment_method_id AND pm.organization_id = p_org_id
    ) THEN
        RAISE EXCEPTION 'Filtro inválido para o tenant: meio de pagamento não pertence à organização.';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_report_filters(UUID, UUID, UUID, UUID, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_report_filters(UUID, UUID, UUID, UUID, UUID, UUID, UUID) FROM authenticated;

-- 4. VISÃO EXECUTIVA
DROP FUNCTION IF EXISTS public.get_executive_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
CREATE FUNCTION public.get_executive_report(
    p_org_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
        RAISE EXCEPTION 'Período inválido.';
    END IF;

    SELECT out_user_id AS user_id, out_user_role AS user_role,
           out_professional_id AS professional_id, out_org_timezone AS org_timezone
    INTO v_access
    FROM public.check_report_access(p_org_id, ARRAY['admin', 'receptionist']);

    SELECT COALESCE(SUM(aps.total), 0)
      INTO v_producao
    FROM public.appointment_services aps
    JOIN public.appointments a
      ON a.id = aps.appointment_id AND a.organization_id = aps.organization_id
    WHERE a.organization_id = p_org_id
      AND a.status = 'completed'
      AND a.finished_at >= p_start_date
      AND a.finished_at <= p_end_date;

    SELECT COALESCE(SUM(ft.amount), 0)
      INTO v_recebimentos
    FROM public.financial_transactions ft
    WHERE ft.organization_id = p_org_id
      AND ft.type = 'income'
      AND ft.voided_at IS NULL
      AND ft.transaction_date >= p_start_date
      AND ft.transaction_date <= p_end_date;

    IF v_access.user_role = 'receptionist' THEN
        v_despesas := 0;
        v_resultado_caixa := 0;
        v_acc_pay_total := 0;
        v_acc_pay_overdue := 0;
        v_acc_pay_pending := 0;
        v_comissoes_a_pagar := 0;
    ELSE
        SELECT COALESCE(SUM(ft.amount), 0)
          INTO v_despesas
        FROM public.financial_transactions ft
        WHERE ft.organization_id = p_org_id
          AND ft.type = 'expense'
          AND ft.voided_at IS NULL
          AND ft.transaction_date >= p_start_date
          AND ft.transaction_date <= p_end_date;

        v_resultado_caixa := v_recebimentos - v_despesas;

        SELECT COALESCE(SUM(ap.remaining_amount), 0)
          INTO v_acc_pay_total
        FROM public.accounts_payable ap
        WHERE ap.organization_id = p_org_id
          AND ap.status IN ('pending', 'partial');

        SELECT COALESCE(SUM(ap.remaining_amount), 0)
          INTO v_acc_pay_overdue
        FROM public.accounts_payable ap
        WHERE ap.organization_id = p_org_id
          AND ap.status IN ('pending', 'partial')
          AND ap.due_date < CURRENT_DATE;

        v_acc_pay_pending := GREATEST(v_acc_pay_total - v_acc_pay_overdue, 0);

        SELECT COALESCE(SUM(c.commission_amount), 0)
          INTO v_comissoes_a_pagar
        FROM public.commissions c
        WHERE c.organization_id = p_org_id
          AND c.status IN ('calculated', 'approved');
    END IF;

    SELECT COALESCE(SUM(ar.remaining_amount), 0)
      INTO v_acc_rec_total
    FROM public.accounts_receivable ar
    WHERE ar.organization_id = p_org_id
      AND ar.status IN ('pending', 'partial');

    SELECT COALESCE(SUM(ar.remaining_amount), 0)
      INTO v_acc_rec_overdue
    FROM public.accounts_receivable ar
    WHERE ar.organization_id = p_org_id
      AND ar.status IN ('pending', 'partial')
      AND ar.due_date < CURRENT_DATE;

    v_acc_rec_pending := GREATEST(v_acc_rec_total - v_acc_rec_overdue, 0);

    SELECT COUNT(DISTINCT ar.client_id)
      INTO v_inadimplentes_count
    FROM public.accounts_receivable ar
    WHERE ar.organization_id = p_org_id
      AND ar.status IN ('pending', 'partial')
      AND ar.due_date < CURRENT_DATE;

    SELECT COUNT(a.id), COUNT(DISTINCT a.client_id)
      INTO v_atendimentos_count, v_clientes_atendidos
    FROM public.appointments a
    WHERE a.organization_id = p_org_id
      AND a.status = 'completed'
      AND a.finished_at >= p_start_date
      AND a.finished_at <= p_end_date;

    IF v_atendimentos_count > 0 THEN
        v_ticket_operacional := ROUND(v_producao / v_atendimentos_count, 2);
    END IF;

    RETURN jsonb_build_object(
        'producao_operacional', v_producao,
        'recebimentos', v_recebimentos,
        'despesas_pagas', v_despesas,
        'resultado_caixa', v_resultado_caixa,
        'contas_receber_total', v_acc_rec_total,
        'contas_receber_vencidas', v_acc_rec_overdue,
        'contas_receber_a_vencer', v_acc_rec_pending,
        'clientes_inadimplentes_count', v_inadimplentes_count,
        'contas_pagar_total', v_acc_pay_total,
        'contas_pagar_vencidas', v_acc_pay_overdue,
        'contas_pagar_a_vencer', v_acc_pay_pending,
        'comissoes_a_pagar', v_comissoes_a_pagar,
        'atendimentos_concluidos_count', v_atendimentos_count,
        'clientes_atendidos_count', v_clientes_atendidos,
        'ticket_medio_operacional', v_ticket_operacional
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_executive_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_executive_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- 5. CLIENTES E RETENÇÃO
DROP FUNCTION IF EXISTS public.get_client_retention_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_client_retention_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID);
CREATE FUNCTION public.get_client_retention_report(
    p_org_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_professional_id UUID DEFAULT NULL,
    p_service_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_access RECORD;
    v_novos_count INT := 0;
    v_recorrentes_count INT := 0;
    v_total_atendidos INT := 0;
    v_taxa_recorrencia NUMERIC := 0;
    v_inativos_threshold INT := 60;
    v_inativos_count INT := 0;
    v_atrasados_count INT := 0;
    v_clientes_grid JSONB := '[]'::jsonb;
    v_atrasados_grid JSONB := '[]'::jsonb;
    v_frequencia_servicos JSONB := '[]'::jsonb;
BEGIN
    IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
        RAISE EXCEPTION 'Período inválido.';
    END IF;

    SELECT out_user_id AS user_id, out_user_role AS user_role,
           out_professional_id AS professional_id, out_org_timezone AS org_timezone
    INTO v_access
    FROM public.check_report_access(p_org_id, ARRAY['admin', 'receptionist', 'professional']);

    IF v_access.user_role = 'professional' THEN
        IF v_access.professional_id IS NULL THEN
            RAISE EXCEPTION 'Profissional autenticado sem vínculo profissional ativo.';
        END IF;
        IF p_professional_id IS NOT NULL AND p_professional_id IS DISTINCT FROM v_access.professional_id THEN
            RAISE EXCEPTION 'Acesso negado: profissionais só podem consultar seus próprios relatórios.';
        END IF;
        p_professional_id := v_access.professional_id;
    END IF;

    PERFORM public.validate_report_filters(p_org_id, p_professional_id, p_service_id, NULL, NULL, NULL, NULL);

    SELECT COALESCE(o.inactive_client_days, 60)
      INTO v_inativos_threshold
    FROM public.organizations o
    WHERE o.id = p_org_id;

    SELECT COUNT(DISTINCT a.client_id)
      INTO v_total_atendidos
    FROM public.appointments a
    JOIN public.appointment_services aps
      ON aps.appointment_id = a.id AND aps.organization_id = a.organization_id
    WHERE a.organization_id = p_org_id
      AND a.status = 'completed'
      AND a.finished_at >= p_start_date
      AND a.finished_at <= p_end_date
      AND (p_professional_id IS NULL OR aps.professional_id = p_professional_id)
      AND (p_service_id IS NULL OR aps.service_id = p_service_id);

    SELECT COUNT(DISTINCT a.client_id)
      INTO v_recorrentes_count
    FROM public.appointments a
    JOIN public.appointment_services aps
      ON aps.appointment_id = a.id AND aps.organization_id = a.organization_id
    WHERE a.organization_id = p_org_id
      AND a.status = 'completed'
      AND a.finished_at >= p_start_date
      AND a.finished_at <= p_end_date
      AND (p_professional_id IS NULL OR aps.professional_id = p_professional_id)
      AND (p_service_id IS NULL OR aps.service_id = p_service_id)
      AND EXISTS (
          SELECT 1
          FROM public.appointments prev
          WHERE prev.organization_id = p_org_id
            AND prev.client_id = a.client_id
            AND prev.status = 'completed'
            AND prev.finished_at < p_start_date
      );

    v_novos_count := GREATEST(v_total_atendidos - v_recorrentes_count, 0);

    IF v_total_atendidos > 0 THEN
        v_taxa_recorrencia := ROUND((v_recorrentes_count::NUMERIC / v_total_atendidos::NUMERIC) * 100, 2);
    END IF;

    SELECT COUNT(*)
      INTO v_inativos_count
    FROM public.clients c
    WHERE c.organization_id = p_org_id
      AND c.is_active = TRUE
      AND c.last_appointment_at IS NOT NULL
      AND c.last_appointment_at < (NOW() - (v_inativos_threshold || ' days')::INTERVAL);

    SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
      INTO v_clientes_grid
    FROM (
        SELECT c.id, c.name, c.phone, c.last_appointment_at,
               COUNT(DISTINCT a.id) AS total_atendimentos_periodo,
               COALESCE(SUM(aps.total), 0) AS total_gasto_periodo,
               CASE WHEN EXISTS (
                   SELECT 1 FROM public.appointments prev
                   WHERE prev.organization_id = p_org_id
                     AND prev.client_id = c.id
                     AND prev.status = 'completed'
                     AND prev.finished_at < p_start_date
               ) THEN 'recorrente' ELSE 'novo' END AS classificacao
        FROM public.clients c
        JOIN public.appointments a
          ON a.client_id = c.id AND a.organization_id = c.organization_id AND a.status = 'completed'
        JOIN public.appointment_services aps
          ON aps.appointment_id = a.id AND aps.organization_id = a.organization_id
        WHERE c.organization_id = p_org_id
          AND a.finished_at >= p_start_date
          AND a.finished_at <= p_end_date
          AND (p_professional_id IS NULL OR aps.professional_id = p_professional_id)
          AND (p_service_id IS NULL OR aps.service_id = p_service_id)
        GROUP BY c.id, c.name, c.phone, c.last_appointment_at
        ORDER BY total_gasto_periodo DESC
    ) t;

    SELECT COUNT(*), COALESCE(jsonb_agg(to_jsonb(a_t)), '[]'::jsonb)
      INTO v_atrasados_count, v_atrasados_grid
    FROM (
        SELECT ra.id AS alert_id,
               c.id AS client_id,
               c.name AS client_name,
               c.phone AS client_phone,
               s.id AS service_id,
               s.name AS service_name,
               prof.id AS professional_id,
               prof.name AS professional_name,
               ra.days_overdue,
               csf.effective_interval_days,
               csf.average_interval_days,
               ra.expected_return_at
        FROM public.return_alerts ra
        JOIN public.clients c
          ON c.id = ra.client_id AND c.organization_id = ra.organization_id
        JOIN public.services s
          ON s.id = ra.service_id AND s.organization_id = ra.organization_id
        LEFT JOIN public.client_service_frequencies csf
          ON csf.id = ra.client_service_frequency_id AND csf.organization_id = ra.organization_id
        LEFT JOIN public.professionals prof
          ON prof.id = csf.last_professional_id AND prof.organization_id = ra.organization_id
        WHERE ra.organization_id = p_org_id
          AND ra.status = 'overdue'
          AND (p_service_id IS NULL OR ra.service_id = p_service_id)
          AND (p_professional_id IS NULL OR csf.last_professional_id = p_professional_id)
        ORDER BY ra.days_overdue DESC, ra.expected_return_at ASC
    ) a_t;

    SELECT COALESCE(jsonb_agg(to_jsonb(f_t)), '[]'::jsonb)
      INTO v_frequencia_servicos
    FROM (
        SELECT s.id AS service_id,
               s.name AS service_name,
               ROUND(AVG(csf.effective_interval_days)::NUMERIC, 1) AS media_dias_frequencia,
               COUNT(*) AS total_clientes_com_historico
        FROM public.client_service_frequencies csf
        JOIN public.services s
          ON s.id = csf.service_id AND s.organization_id = csf.organization_id
        WHERE csf.organization_id = p_org_id
          AND csf.is_active = TRUE
          AND csf.effective_interval_days IS NOT NULL
          AND (p_service_id IS NULL OR csf.service_id = p_service_id)
          AND (p_professional_id IS NULL OR csf.last_professional_id = p_professional_id)
        GROUP BY s.id, s.name
        ORDER BY total_clientes_com_historico DESC, s.name
    ) f_t;

    RETURN jsonb_build_object(
        'novos_clientes', v_novos_count,
        'clientes_recorrentes', v_recorrentes_count,
        'total_clientes_atendidos', v_total_atendidos,
        'taxa_recorrencia_pct', v_taxa_recorrencia,
        'clientes_inativos_count', v_inativos_count,
        'clientes_atrasados_count', v_atrasados_count,
        'inativos_threshold_days', v_inativos_threshold,
        'clientes_grid', v_clientes_grid,
        'atrasados_grid', v_atrasados_grid,
        'frequencia_servicos_grid', v_frequencia_servicos
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_retention_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_retention_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) TO authenticated;

-- 6. SERVIÇOS
DROP FUNCTION IF EXISTS public.get_services_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_services_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID);
CREATE FUNCTION public.get_services_report(
    p_org_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_category_id UUID DEFAULT NULL,
    p_professional_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_access RECORD;
    v_producao_total NUMERIC := 0;
    v_quantidade_total INT := 0;
    v_ticket_medio_servico NUMERIC := 0;
    v_top_quantidade JSONB := '[]'::jsonb;
    v_top_receita JSONB := '[]'::jsonb;
    v_servicos_grid JSONB := '[]'::jsonb;
BEGIN
    IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
        RAISE EXCEPTION 'Período inválido.';
    END IF;

    SELECT out_user_id AS user_id, out_user_role AS user_role,
           out_professional_id AS professional_id, out_org_timezone AS org_timezone
    INTO v_access
    FROM public.check_report_access(p_org_id, ARRAY['admin', 'receptionist', 'professional']);

    IF v_access.user_role = 'professional' THEN
        IF v_access.professional_id IS NULL THEN
            RAISE EXCEPTION 'Profissional autenticado sem vínculo profissional ativo.';
        END IF;
        IF p_professional_id IS NOT NULL AND p_professional_id IS DISTINCT FROM v_access.professional_id THEN
            RAISE EXCEPTION 'Acesso negado: profissionais só podem consultar seus próprios relatórios.';
        END IF;
        p_professional_id := v_access.professional_id;
    END IF;

    PERFORM public.validate_report_filters(p_org_id, p_professional_id, NULL, NULL, p_category_id, NULL, NULL);

    SELECT COALESCE(SUM(aps.total), 0), COUNT(aps.id)
      INTO v_producao_total, v_quantidade_total
    FROM public.appointment_services aps
    JOIN public.appointments a
      ON a.id = aps.appointment_id AND a.organization_id = aps.organization_id
    JOIN public.services s
      ON s.id = aps.service_id AND s.organization_id = aps.organization_id
    WHERE a.organization_id = p_org_id
      AND a.status = 'completed'
      AND a.finished_at >= p_start_date
      AND a.finished_at <= p_end_date
      AND (p_category_id IS NULL OR s.category_id = p_category_id)
      AND (p_professional_id IS NULL OR aps.professional_id = p_professional_id);

    IF v_quantidade_total > 0 THEN
        v_ticket_medio_servico := ROUND(v_producao_total / v_quantidade_total, 2);
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(q_t)), '[]'::jsonb)
      INTO v_top_quantidade
    FROM (
        SELECT s.id AS service_id, s.name AS service_name, sc.name AS category_name,
               COUNT(aps.id) AS quantidade, COALESCE(SUM(aps.total), 0) AS producao_total
        FROM public.appointment_services aps
        JOIN public.appointments a
          ON a.id = aps.appointment_id AND a.organization_id = aps.organization_id
        JOIN public.services s
          ON s.id = aps.service_id AND s.organization_id = aps.organization_id
        LEFT JOIN public.service_categories sc
          ON sc.id = s.category_id AND sc.organization_id = s.organization_id
        WHERE a.organization_id = p_org_id
          AND a.status = 'completed'
          AND a.finished_at >= p_start_date
          AND a.finished_at <= p_end_date
          AND (p_category_id IS NULL OR s.category_id = p_category_id)
          AND (p_professional_id IS NULL OR aps.professional_id = p_professional_id)
        GROUP BY s.id, s.name, sc.name
        ORDER BY quantidade DESC, producao_total DESC
        LIMIT 10
    ) q_t;

    SELECT COALESCE(jsonb_agg(to_jsonb(r_t)), '[]'::jsonb)
      INTO v_top_receita
    FROM (
        SELECT s.id AS service_id, s.name AS service_name, sc.name AS category_name,
               COUNT(aps.id) AS quantidade, COALESCE(SUM(aps.total), 0) AS producao_total
        FROM public.appointment_services aps
        JOIN public.appointments a
          ON a.id = aps.appointment_id AND a.organization_id = aps.organization_id
        JOIN public.services s
          ON s.id = aps.service_id AND s.organization_id = aps.organization_id
        LEFT JOIN public.service_categories sc
          ON sc.id = s.category_id AND sc.organization_id = s.organization_id
        WHERE a.organization_id = p_org_id
          AND a.status = 'completed'
          AND a.finished_at >= p_start_date
          AND a.finished_at <= p_end_date
          AND (p_category_id IS NULL OR s.category_id = p_category_id)
          AND (p_professional_id IS NULL OR aps.professional_id = p_professional_id)
        GROUP BY s.id, s.name, sc.name
        ORDER BY producao_total DESC, quantidade DESC
        LIMIT 10
    ) r_t;

    SELECT COALESCE(jsonb_agg(to_jsonb(grid_t)), '[]'::jsonb)
      INTO v_servicos_grid
    FROM (
        SELECT s.id AS service_id, s.name AS service_name, sc.name AS category_name,
               s.price AS preco_tabela,
               COUNT(aps.id) FILTER (WHERE a.id IS NOT NULL) AS quantidade_executada,
               COALESCE(SUM(aps.total) FILTER (WHERE a.id IS NOT NULL), 0) AS producao_gerada,
               CASE WHEN COUNT(aps.id) FILTER (WHERE a.id IS NOT NULL) > 0
                    THEN ROUND(
                        COALESCE(SUM(aps.total) FILTER (WHERE a.id IS NOT NULL), 0)
                        / COUNT(aps.id) FILTER (WHERE a.id IS NOT NULL), 2)
                    ELSE 0 END AS ticket_medio
        FROM public.services s
        LEFT JOIN public.service_categories sc
          ON sc.id = s.category_id AND sc.organization_id = s.organization_id
        LEFT JOIN public.appointment_services aps
          ON aps.service_id = s.id AND aps.organization_id = s.organization_id
         AND (p_professional_id IS NULL OR aps.professional_id = p_professional_id)
        LEFT JOIN public.appointments a
          ON a.id = aps.appointment_id AND a.organization_id = aps.organization_id
         AND a.status = 'completed'
         AND a.finished_at >= p_start_date AND a.finished_at <= p_end_date
        WHERE s.organization_id = p_org_id
          AND (p_category_id IS NULL OR s.category_id = p_category_id)
        GROUP BY s.id, s.name, sc.name, s.price
        ORDER BY producao_gerada DESC, quantidade_executada DESC, s.name
    ) grid_t;

    RETURN jsonb_build_object(
        'producao_total_servicos', v_producao_total,
        'quantidade_total_servicos', v_quantidade_total,
        'ticket_medio_servico', v_ticket_medio_servico,
        'top_quantidade_grid', v_top_quantidade,
        'top_receita_grid', v_top_receita,
        'servicos_grid', v_servicos_grid
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_services_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_services_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) TO authenticated;

-- 7. PROFISSIONAIS
DROP FUNCTION IF EXISTS public.get_professionals_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_professionals_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID);
CREATE FUNCTION public.get_professionals_report(
    p_org_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_professional_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_access RECORD;
    v_target_prof_id UUID := p_professional_id;
    v_profissionais_grid JSONB := '[]'::jsonb;
    v_ranking_producao JSONB := '[]'::jsonb;
BEGIN
    IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
        RAISE EXCEPTION 'Período inválido.';
    END IF;

    SELECT out_user_id AS user_id, out_user_role AS user_role,
           out_professional_id AS professional_id, out_org_timezone AS org_timezone
    INTO v_access
    FROM public.check_report_access(p_org_id, ARRAY['admin', 'receptionist', 'professional']);

    IF v_access.user_role = 'professional' THEN
        IF v_access.professional_id IS NULL THEN
            RAISE EXCEPTION 'Profissional autenticado sem vínculo profissional ativo.';
        END IF;
        IF v_target_prof_id IS NOT NULL AND v_target_prof_id IS DISTINCT FROM v_access.professional_id THEN
            RAISE EXCEPTION 'Acesso negado: profissionais só podem visualizar seus próprios indicadores.';
        END IF;
        v_target_prof_id := v_access.professional_id;
    END IF;

    PERFORM public.validate_report_filters(p_org_id, v_target_prof_id, NULL, NULL, NULL, NULL, NULL);

    SELECT COALESCE(jsonb_agg(to_jsonb(p_t)), '[]'::jsonb)
      INTO v_profissionais_grid
    FROM (
        SELECT p.id AS professional_id, p.name AS professional_name,
               COUNT(DISTINCT a.id) FILTER (WHERE a.id IS NOT NULL) AS atendimentos_count,
               COUNT(aps.id) FILTER (WHERE a.id IS NOT NULL) AS servicos_count,
               COALESCE(SUM(aps.total) FILTER (WHERE a.id IS NOT NULL), 0) AS producao_bruta,
               CASE WHEN COUNT(DISTINCT a.id) FILTER (WHERE a.id IS NOT NULL) > 0
                    THEN ROUND(
                        COALESCE(SUM(aps.total) FILTER (WHERE a.id IS NOT NULL), 0)
                        / COUNT(DISTINCT a.id) FILTER (WHERE a.id IS NOT NULL), 2)
                    ELSE 0 END AS ticket_medio_operacional,
               COALESCE(SUM(ci.commission_amount) FILTER (WHERE a.id IS NOT NULL), 0) AS comissao_gerada
        FROM public.professionals p
        LEFT JOIN public.appointment_services aps
          ON aps.professional_id = p.id AND aps.organization_id = p.organization_id
        LEFT JOIN public.appointments a
          ON a.id = aps.appointment_id AND a.organization_id = aps.organization_id
         AND a.status = 'completed'
         AND a.finished_at >= p_start_date AND a.finished_at <= p_end_date
        LEFT JOIN public.commission_items ci
          ON ci.appointment_service_id = aps.id AND ci.organization_id = p.organization_id
        WHERE p.organization_id = p_org_id
          AND p.is_active = TRUE
          AND (v_target_prof_id IS NULL OR p.id = v_target_prof_id)
        GROUP BY p.id, p.name
        ORDER BY producao_bruta DESC, p.name
    ) p_t;

    SELECT COALESCE(jsonb_agg(to_jsonb(rk_t)), '[]'::jsonb)
      INTO v_ranking_producao
    FROM (
        SELECT p.id AS professional_id, p.name AS professional_name,
               COALESCE(SUM(aps.total), 0) AS producao_bruta,
               COUNT(DISTINCT a.id) AS atendimentos_count
        FROM public.professionals p
        JOIN public.appointment_services aps
          ON aps.professional_id = p.id AND aps.organization_id = p.organization_id
        JOIN public.appointments a
          ON a.id = aps.appointment_id AND a.organization_id = aps.organization_id
        WHERE a.organization_id = p_org_id
          AND a.status = 'completed'
          AND a.finished_at >= p_start_date
          AND a.finished_at <= p_end_date
          AND (v_target_prof_id IS NULL OR p.id = v_target_prof_id)
        GROUP BY p.id, p.name
        ORDER BY producao_bruta DESC, atendimentos_count DESC, p.name
    ) rk_t;

    RETURN jsonb_build_object(
        'profissionais_grid', v_profissionais_grid,
        'ranking_producao_grid', v_ranking_producao
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_professionals_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_professionals_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;

-- 8. PACOTES
DROP FUNCTION IF EXISTS public.get_packages_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_packages_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID);
CREATE FUNCTION public.get_packages_report(
    p_org_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_package_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_access RECORD;
    v_total_vendidos INT := 0;
    v_receita_total NUMERIC := 0;
    v_usos_total INT := 0;
    v_renovacoes_count INT := 0;
    v_base_elegivel_renovacao INT := 0;
    v_taxa_renovacao NUMERIC := NULL;
    v_pacotes_grid JSONB := '[]'::jsonb;
    v_usos_grid JSONB := '[]'::jsonb;
    v_renovacoes_grid JSONB := '[]'::jsonb;
BEGIN
    IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
        RAISE EXCEPTION 'Período inválido.';
    END IF;

    SELECT out_user_id AS user_id, out_user_role AS user_role,
           out_professional_id AS professional_id, out_org_timezone AS org_timezone
    INTO v_access
    FROM public.check_report_access(p_org_id, ARRAY['admin', 'receptionist']);

    PERFORM public.validate_report_filters(p_org_id, NULL, NULL, NULL, NULL, p_package_id, NULL);

    SELECT COUNT(cp.id), COALESCE(SUM(cp.amount_paid), 0)
      INTO v_total_vendidos, v_receita_total
    FROM public.client_packages cp
    WHERE cp.organization_id = p_org_id
      AND cp.purchased_at >= p_start_date
      AND cp.purchased_at <= p_end_date
      AND (p_package_id IS NULL OR cp.package_id = p_package_id);

    SELECT COUNT(pu.id)
      INTO v_usos_total
    FROM public.package_usages pu
    JOIN public.client_packages cp
      ON cp.id = pu.client_package_id AND cp.organization_id = pu.organization_id
    WHERE pu.organization_id = p_org_id
      AND pu.voided_at IS NULL
      AND pu.used_at >= p_start_date
      AND pu.used_at <= p_end_date
      AND (p_package_id IS NULL OR cp.package_id = p_package_id);

    SELECT COUNT(new_cp.id)
      INTO v_renovacoes_count
    FROM public.client_packages new_cp
    WHERE new_cp.organization_id = p_org_id
      AND new_cp.renewed_from_client_package_id IS NOT NULL
      AND new_cp.purchased_at >= p_start_date
      AND new_cp.purchased_at <= p_end_date
      AND (p_package_id IS NULL OR new_cp.package_id = p_package_id);

    SELECT COUNT(orig_cp.id)
      INTO v_base_elegivel_renovacao
    FROM public.client_packages orig_cp
    WHERE orig_cp.organization_id = p_org_id
      AND orig_cp.status IN ('completed', 'expired')
      AND orig_cp.updated_at >= p_start_date
      AND orig_cp.updated_at <= p_end_date
      AND (p_package_id IS NULL OR orig_cp.package_id = p_package_id);

    IF v_base_elegivel_renovacao > 0 THEN
        v_taxa_renovacao := ROUND((v_renovacoes_count::NUMERIC / v_base_elegivel_renovacao::NUMERIC) * 100, 2);
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(pkg_t)), '[]'::jsonb)
      INTO v_pacotes_grid
    FROM (
        SELECT p.id AS package_id, p.name AS package_name,
               COUNT(cp.id) FILTER (WHERE cp.purchased_at >= p_start_date AND cp.purchased_at <= p_end_date) AS quantidade_vendida,
               COALESCE(SUM(cp.amount_paid) FILTER (WHERE cp.purchased_at >= p_start_date AND cp.purchased_at <= p_end_date), 0) AS receita_gerada,
               COUNT(DISTINCT cp.client_id) FILTER (WHERE cp.purchased_at >= p_start_date AND cp.purchased_at <= p_end_date) AS clientes_compradores
        FROM public.packages p
        LEFT JOIN public.client_packages cp
          ON cp.package_id = p.id AND cp.organization_id = p.organization_id
        WHERE p.organization_id = p_org_id
          AND (p_package_id IS NULL OR p.id = p_package_id)
        GROUP BY p.id, p.name
        ORDER BY receita_gerada DESC, quantidade_vendida DESC, p.name
    ) pkg_t;

    SELECT COALESCE(jsonb_agg(to_jsonb(u_t)), '[]'::jsonb)
      INTO v_usos_grid
    FROM (
        SELECT pu.id AS usage_id, c.name AS client_name, pkg.name AS package_name,
               s.name AS service_name, prof.name AS professional_name,
               pu.quantity, pu.used_at
        FROM public.package_usages pu
        JOIN public.client_packages cp
          ON cp.id = pu.client_package_id AND cp.organization_id = pu.organization_id
        LEFT JOIN public.packages pkg
          ON pkg.id = cp.package_id AND pkg.organization_id = cp.organization_id
        JOIN public.clients c
          ON c.id = cp.client_id AND c.organization_id = cp.organization_id
        JOIN public.services s
          ON s.id = pu.service_id AND s.organization_id = pu.organization_id
        LEFT JOIN public.professionals prof
          ON prof.id = pu.professional_id AND prof.organization_id = pu.organization_id
        WHERE pu.organization_id = p_org_id
          AND pu.voided_at IS NULL
          AND pu.used_at >= p_start_date
          AND pu.used_at <= p_end_date
          AND (p_package_id IS NULL OR cp.package_id = p_package_id)
        ORDER BY pu.used_at DESC
        LIMIT 50
    ) u_t;

    SELECT COALESCE(jsonb_agg(to_jsonb(ren_t)), '[]'::jsonb)
      INTO v_renovacoes_grid
    FROM (
        SELECT new_cp.id AS new_client_package_id, c.name AS client_name,
               pkg.name AS package_name, new_cp.purchased_at AS renewed_at,
               new_cp.amount_paid
        FROM public.client_packages new_cp
        JOIN public.clients c
          ON c.id = new_cp.client_id AND c.organization_id = new_cp.organization_id
        LEFT JOIN public.packages pkg
          ON pkg.id = new_cp.package_id AND pkg.organization_id = new_cp.organization_id
        WHERE new_cp.organization_id = p_org_id
          AND new_cp.renewed_from_client_package_id IS NOT NULL
          AND new_cp.purchased_at >= p_start_date
          AND new_cp.purchased_at <= p_end_date
          AND (p_package_id IS NULL OR new_cp.package_id = p_package_id)
        ORDER BY new_cp.purchased_at DESC
    ) ren_t;

    RETURN jsonb_build_object(
        'total_pacotes_vendidos', v_total_vendidos,
        'receita_total_pacotes', v_receita_total,
        'usos_total_periodo', v_usos_total,
        'renovacoes_count', v_renovacoes_count,
        'base_elegivel_renovacao', v_base_elegivel_renovacao,
        'taxa_renovacao_pct', v_taxa_renovacao,
        'pacotes_grid', v_pacotes_grid,
        'usos_grid', v_usos_grid,
        'renovacoes_grid', v_renovacoes_grid
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_packages_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_packages_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;

-- 9. FINANCEIRO
DROP FUNCTION IF EXISTS public.get_financial_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_financial_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID);
CREATE FUNCTION public.get_financial_report(
    p_org_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_payment_method_id UUID DEFAULT NULL,
    p_category_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_access RECORD;
    v_recebimentos NUMERIC := 0;
    v_despesas NUMERIC := 0;
    v_resultado_caixa NUMERIC := 0;
    v_aging_a_vencer NUMERIC := 0;
    v_aging_1_7 NUMERIC := 0;
    v_aging_8_15 NUMERIC := 0;
    v_aging_16_30 NUMERIC := 0;
    v_aging_31_60 NUMERIC := 0;
    v_aging_60_plus NUMERIC := 0;
    v_recebimentos_meios JSONB := '[]'::jsonb;
    v_despesas_categorias JSONB := '[]'::jsonb;
    v_caixa_summary JSONB := '{}'::jsonb;
    v_contas_receber JSONB := '[]'::jsonb;
    v_contas_pagar JSONB := '[]'::jsonb;
    v_divergencias JSONB := '[]'::jsonb;
    v_auditoria JSONB := '[]'::jsonb;
    v_caixas_abertos INT := 0;
    v_caixas_fechados INT := 0;
    v_total_suprimentos NUMERIC := 0;
    v_total_sangrias NUMERIC := 0;
    v_total_divergencias_abs NUMERIC := 0;
BEGIN
    IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
        RAISE EXCEPTION 'Período inválido.';
    END IF;

    SELECT out_user_id AS user_id, out_user_role AS user_role,
           out_professional_id AS professional_id, out_org_timezone AS org_timezone
    INTO v_access
    FROM public.check_report_access(p_org_id, ARRAY['admin']);

    PERFORM public.validate_report_filters(p_org_id, NULL, NULL, NULL, p_category_id, NULL, p_payment_method_id);

    SELECT COALESCE(SUM(ft.amount), 0)
      INTO v_recebimentos
    FROM public.financial_transactions ft
    WHERE ft.organization_id = p_org_id
      AND ft.type = 'income'
      AND ft.voided_at IS NULL
      AND ft.transaction_date >= p_start_date
      AND ft.transaction_date <= p_end_date
      AND (p_payment_method_id IS NULL OR ft.payment_method_id = p_payment_method_id)
      AND (p_category_id IS NULL OR ft.category_id = p_category_id);

    SELECT COALESCE(SUM(ft.amount), 0)
      INTO v_despesas
    FROM public.financial_transactions ft
    WHERE ft.organization_id = p_org_id
      AND ft.type = 'expense'
      AND ft.voided_at IS NULL
      AND ft.transaction_date >= p_start_date
      AND ft.transaction_date <= p_end_date
      AND (p_payment_method_id IS NULL OR ft.payment_method_id = p_payment_method_id)
      AND (p_category_id IS NULL OR ft.category_id = p_category_id);

    v_resultado_caixa := v_recebimentos - v_despesas;

    SELECT COALESCE(jsonb_agg(to_jsonb(m_t)), '[]'::jsonb)
      INTO v_recebimentos_meios
    FROM (
        SELECT pm.id AS payment_method_id, pm.name AS meio_pagamento,
               COALESCE(SUM(ft.amount), 0) AS total
        FROM public.financial_transactions ft
        JOIN public.payment_methods pm
          ON pm.id = ft.payment_method_id AND pm.organization_id = ft.organization_id
        WHERE ft.organization_id = p_org_id
          AND ft.type = 'income'
          AND ft.voided_at IS NULL
          AND ft.transaction_date >= p_start_date
          AND ft.transaction_date <= p_end_date
          AND (p_payment_method_id IS NULL OR ft.payment_method_id = p_payment_method_id)
          AND (p_category_id IS NULL OR ft.category_id = p_category_id)
        GROUP BY pm.id, pm.name
        ORDER BY total DESC
    ) m_t;

    SELECT COALESCE(jsonb_agg(to_jsonb(cat_t)), '[]'::jsonb)
      INTO v_despesas_categorias
    FROM (
        SELECT fc.id AS category_id, fc.name AS categoria,
               COALESCE(SUM(ft.amount), 0) AS total
        FROM public.financial_transactions ft
        JOIN public.financial_categories fc
          ON fc.id = ft.category_id AND fc.organization_id = ft.organization_id
        WHERE ft.organization_id = p_org_id
          AND ft.type = 'expense'
          AND ft.voided_at IS NULL
          AND ft.transaction_date >= p_start_date
          AND ft.transaction_date <= p_end_date
          AND (p_payment_method_id IS NULL OR ft.payment_method_id = p_payment_method_id)
          AND (p_category_id IS NULL OR ft.category_id = p_category_id)
        GROUP BY fc.id, fc.name
        ORDER BY total DESC
    ) cat_t;

    SELECT
        COALESCE(SUM(CASE WHEN ar.due_date >= CURRENT_DATE THEN ar.remaining_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN ar.due_date < CURRENT_DATE AND ar.due_date >= CURRENT_DATE - 7 THEN ar.remaining_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN ar.due_date < CURRENT_DATE - 7 AND ar.due_date >= CURRENT_DATE - 15 THEN ar.remaining_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN ar.due_date < CURRENT_DATE - 15 AND ar.due_date >= CURRENT_DATE - 30 THEN ar.remaining_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN ar.due_date < CURRENT_DATE - 30 AND ar.due_date >= CURRENT_DATE - 60 THEN ar.remaining_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN ar.due_date < CURRENT_DATE - 60 THEN ar.remaining_amount ELSE 0 END), 0)
    INTO v_aging_a_vencer, v_aging_1_7, v_aging_8_15, v_aging_16_30, v_aging_31_60, v_aging_60_plus
    FROM public.accounts_receivable ar
    WHERE ar.organization_id = p_org_id
      AND ar.status IN ('pending', 'partial')
      AND ar.remaining_amount > 0;

    SELECT COALESCE(jsonb_agg(to_jsonb(ar_t)), '[]'::jsonb)
      INTO v_contas_receber
    FROM (
        SELECT ar.id AS account_receivable_id, c.name AS client_name,
               ar.description, ar.original_amount, ar.paid_amount,
               ar.remaining_amount, ar.due_date, ar.status,
               CASE WHEN ar.due_date < CURRENT_DATE THEN CURRENT_DATE - ar.due_date ELSE 0 END AS atraso_dias
        FROM public.accounts_receivable ar
        LEFT JOIN public.clients c
          ON c.id = ar.client_id AND c.organization_id = ar.organization_id
        WHERE ar.organization_id = p_org_id
          AND ar.status IN ('pending', 'partial')
          AND ar.remaining_amount > 0
        ORDER BY ar.due_date ASC
        LIMIT 20
    ) ar_t;

    SELECT COALESCE(jsonb_agg(to_jsonb(ap_t)), '[]'::jsonb)
      INTO v_contas_pagar
    FROM (
        SELECT ap.id AS account_payable_id, fc.name AS category_name,
               ap.supplier_name, ap.description, ap.original_amount,
               ap.paid_amount, ap.remaining_amount, ap.due_date, ap.status,
               CASE WHEN ap.due_date < CURRENT_DATE THEN CURRENT_DATE - ap.due_date ELSE 0 END AS atraso_dias
        FROM public.accounts_payable ap
        LEFT JOIN public.financial_categories fc
          ON fc.id = ap.category_id AND fc.organization_id = ap.organization_id
        WHERE ap.organization_id = p_org_id
          AND ap.status IN ('pending', 'partial')
          AND ap.remaining_amount > 0
        ORDER BY ap.due_date ASC
        LIMIT 20
    ) ap_t;

    SELECT COUNT(*) FILTER (WHERE cr.status = 'open'),
           COUNT(*) FILTER (WHERE cr.status = 'closed'),
           COALESCE(SUM(ABS(cr.difference)) FILTER (WHERE cr.status = 'closed' AND cr.difference IS NOT NULL), 0)
      INTO v_caixas_abertos, v_caixas_fechados, v_total_divergencias_abs
    FROM public.cash_registers cr
    WHERE cr.organization_id = p_org_id
      AND cr.opened_at >= p_start_date
      AND cr.opened_at <= p_end_date;

    SELECT COALESCE(SUM(cm.amount) FILTER (WHERE cm.type = 'supply'), 0),
           COALESCE(SUM(cm.amount) FILTER (WHERE cm.type = 'withdrawal'), 0)
      INTO v_total_suprimentos, v_total_sangrias
    FROM public.cash_movements cm
    WHERE cm.organization_id = p_org_id
      AND cm.created_at >= p_start_date
      AND cm.created_at <= p_end_date;

    v_caixa_summary := jsonb_build_object(
        'caixas_abertos_count', v_caixas_abertos,
        'caixas_fechados_count', v_caixas_fechados,
        'total_suprimentos', v_total_suprimentos,
        'total_sangrias', v_total_sangrias,
        'total_divergencias_abs', v_total_divergencias_abs
    );

    SELECT COALESCE(jsonb_agg(to_jsonb(div_t)), '[]'::jsonb)
      INTO v_divergencias
    FROM (
        SELECT cr.id AS cash_register_id, cr.opened_at, cr.closed_at,
               cr.expected_balance, cr.closing_balance, cr.difference, cr.notes
        FROM public.cash_registers cr
        WHERE cr.organization_id = p_org_id
          AND cr.status = 'closed'
          AND COALESCE(cr.difference, 0) <> 0
          AND cr.closed_at >= p_start_date
          AND cr.closed_at <= p_end_date
        ORDER BY cr.closed_at DESC
    ) div_t;

    SELECT COALESCE(jsonb_agg(to_jsonb(aud_t)), '[]'::jsonb)
      INTO v_auditoria
    FROM (
        SELECT ft.id AS transaction_id, ft.type, ft.amount, ft.description,
               ft.voided_at, ft.voided_by, ft.void_reason, ft.created_at
        FROM public.financial_transactions ft
        WHERE ft.organization_id = p_org_id
          AND ft.voided_at IS NOT NULL
          AND ft.voided_at >= p_start_date
          AND ft.voided_at <= p_end_date
        ORDER BY ft.voided_at DESC
    ) aud_t;

    RETURN jsonb_build_object(
        'recebimentos_total', v_recebimentos,
        'despesas_pagas_total', v_despesas,
        'resultado_caixa', v_resultado_caixa,
        'aging_contas_receber', jsonb_build_object(
            'a_vencer', v_aging_a_vencer,
            'dias_1_7', v_aging_1_7,
            'dias_8_15', v_aging_8_15,
            'dias_16_30', v_aging_16_30,
            'dias_31_60', v_aging_31_60,
            'dias_60_plus', v_aging_60_plus
        ),
        'recebimentos_meios', v_recebimentos_meios,
        'contas_receber', v_contas_receber,
        'contas_pagar', v_contas_pagar,
        'despesas_categorias', v_despesas_categorias,
        'caixa_summary', v_caixa_summary,
        'divergencias_caixa', v_divergencias,
        'auditoria_transacoes', v_auditoria
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_financial_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID) TO authenticated;

COMMIT;
