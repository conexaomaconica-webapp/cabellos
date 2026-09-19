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
    IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'receptionist') THEN
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
    IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'receptionist') THEN
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
    WHERE cash_registers.id = p_cash_register_id;

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
    WHERE accounts_receivable.id = p_account_receivable_id;

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
    IF v_user_role IS NULL OR v_user_role != 'admin' THEN
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
    WHERE accounts_payable.id = p_account_payable_id;

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
        WHERE appointments.id = v_app_id AND organization_id = v_org_id;
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
    WHERE appointments.id = v_app_id AND organization_id = v_org_id;

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
