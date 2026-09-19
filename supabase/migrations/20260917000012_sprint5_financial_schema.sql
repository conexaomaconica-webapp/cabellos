-- Migration 12: Sprint 5 Schema (Financial Categories, Cash Registers, Cash Movements, Financial Transactions, Accounts Receivable/Payable, Commissions)

-- 1. TABELA FINANCIAL_CATEGORIES (Categorias Financeiras de Receitas e Despesas)
CREATE TABLE IF NOT EXISTS public.financial_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_financial_categories_org_name_type UNIQUE (organization_id, name, type)
);

-- 2. TABELA CASH_REGISTERS (Fechamento e Controle Diário de Caixa)
CREATE TABLE IF NOT EXISTS public.cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    closing_balance NUMERIC(12,2),
    expected_balance NUMERIC(12,2),
    difference NUMERIC(12,2),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice Único Parcial: Garante que exista no máximo 1 caixa aberto por organização
CREATE UNIQUE INDEX IF NOT EXISTS uq_open_cash_register ON public.cash_registers(organization_id) WHERE status = 'open';

-- 3. TABELA CASH_MOVEMENTS (Movimentações Físicas da Gaveta de Caixa: Venda, Suprimento, Sangria, etc.)
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('opening', 'sale', 'receipt', 'supply', 'withdrawal', 'expense', 'closing_adjustment')),
    amount NUMERIC(12,2) NOT NULL,
    description TEXT,
    financial_transaction_id UUID,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABELA FINANCIAL_TRANSACTIONS (Razão Financeiro Auditável com Trava Anti-Duplicação)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE RESTRICT,
    description TEXT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_type TEXT CHECK (source_type IN ('appointment_payment', 'client_package_payment', 'receivable_payment', 'payable_payment', 'manual_income', 'manual_expense', 'commission_payment')),
    source_id UUID,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    client_package_id UUID REFERENCES public.client_packages(id) ON DELETE SET NULL,
    professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    void_reason TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fin_tx_org_source UNIQUE (organization_id, source_type, source_id)
);

-- Foreign Key retroativa em cash_movements para financial_transactions
ALTER TABLE public.cash_movements
    DROP CONSTRAINT IF EXISTS fk_cash_movements_fin_tx,
    ADD CONSTRAINT fk_cash_movements_fin_tx
    FOREIGN KEY (financial_transaction_id) REFERENCES public.financial_transactions(id) ON DELETE SET NULL;

-- 5. TABELA ACCOUNTS_RECEIVABLE (Contas a Receber de Clientes)
CREATE TABLE IF NOT EXISTS public.accounts_receivable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    client_package_id UUID REFERENCES public.client_packages(id) ON DELETE SET NULL,
    description TEXT,
    original_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    remaining_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    due_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABELA ACCOUNTS_PAYABLE (Contas a Pagar / Despesas Operacionais)
CREATE TABLE IF NOT EXISTS public.accounts_payable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    supplier_name TEXT,
    category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    original_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    remaining_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    due_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABELA ACCOUNT_PAYABLE_PAYMENTS (Baixas Parciais/Totais de Contas a Pagar)
CREATE TABLE IF NOT EXISTS public.account_payable_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    account_payable_id UUID NOT NULL REFERENCES public.accounts_payable(id) ON DELETE CASCADE,
    payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    financial_transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABELA COMMISSIONS (Apuração de Comissões por Profissional)
CREATE TABLE IF NOT EXISTS public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    production_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'calculated' CHECK (status IN ('calculated', 'approved', 'paid')),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    paid_at TIMESTAMPTZ,
    account_payable_id UUID REFERENCES public.accounts_payable(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TABELA COMMISSION_ITEMS (Detalhamento Unificado de Itens de Comissão com Trava Anti-Duplicação)
CREATE TABLE IF NOT EXISTS public.commission_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    commission_id UUID NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
    appointment_service_id UUID NOT NULL REFERENCES public.appointment_services(id) ON DELETE RESTRICT,
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
    production_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_comm_items_org_app_svc UNIQUE (organization_id, appointment_service_id)
);

-- CONSTRAINTS MONETÁRIAS DA SPRINT 5
ALTER TABLE public.financial_transactions
    DROP CONSTRAINT IF EXISTS chk_fin_tx_amt,
    ADD CONSTRAINT chk_fin_tx_amt CHECK (amount >= 0.00);

ALTER TABLE public.accounts_receivable
    DROP CONSTRAINT IF EXISTS chk_acc_rec_orig,
    ADD CONSTRAINT chk_acc_rec_orig CHECK (original_amount >= 0.00),
    DROP CONSTRAINT IF EXISTS chk_acc_rec_paid,
    ADD CONSTRAINT chk_acc_rec_paid CHECK (paid_amount >= 0.00),
    DROP CONSTRAINT IF EXISTS chk_acc_rec_rem,
    ADD CONSTRAINT chk_acc_rec_rem CHECK (remaining_amount >= 0.00);

ALTER TABLE public.accounts_payable
    DROP CONSTRAINT IF EXISTS chk_acc_pay_orig,
    ADD CONSTRAINT chk_acc_pay_orig CHECK (original_amount >= 0.00),
    DROP CONSTRAINT IF EXISTS chk_acc_pay_paid,
    ADD CONSTRAINT chk_acc_pay_paid CHECK (paid_amount >= 0.00),
    DROP CONSTRAINT IF EXISTS chk_acc_pay_rem,
    ADD CONSTRAINT chk_acc_pay_rem CHECK (remaining_amount >= 0.00);

ALTER TABLE public.account_payable_payments
    DROP CONSTRAINT IF EXISTS chk_acc_pay_pmt_amt,
    ADD CONSTRAINT chk_acc_pay_pmt_amt CHECK (amount > 0.00);

ALTER TABLE public.commissions
    DROP CONSTRAINT IF EXISTS chk_comm_prod,
    ADD CONSTRAINT chk_comm_prod CHECK (production_total >= 0.00),
    DROP CONSTRAINT IF EXISTS chk_comm_amt,
    ADD CONSTRAINT chk_comm_amt CHECK (commission_amount >= 0.00);

-- ÍNDICES DE PERFORMANCE DA SPRINT 5
CREATE INDEX IF NOT EXISTS idx_fin_cat_org ON public.financial_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_reg_org_status ON public.cash_registers(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_mov_reg ON public.cash_movements(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_org_date ON public.financial_transactions(organization_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_tx_type ON public.financial_transactions(organization_id, type);
CREATE INDEX IF NOT EXISTS idx_acc_rec_org_client ON public.accounts_receivable(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_acc_rec_status ON public.accounts_receivable(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_acc_pay_org_status ON public.accounts_payable(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_acc_pay_pmt_pay ON public.account_payable_payments(account_payable_id);
CREATE INDEX IF NOT EXISTS idx_comm_org_prof ON public.commissions(organization_id, professional_id);
CREATE INDEX IF NOT EXISTS idx_comm_items_comm ON public.commission_items(commission_id);
