-- Migration 18: Fix column name in get_executive_report RPC (commission_amount instead of amount)
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

        -- Comissões a Pagar (Corrigido: commission_amount ao invés de amount)
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
