-- Migration 10: Sprint 4 Schema (Packages, Plans, Rules, Client Packages, Usages, Payments)

-- 1. ADICIONAR COLUNAS DE SUPORTE A PACOTES EM ORGANIZATIONS E APPOINTMENTS
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS allow_package_usage_with_pending_balance BOOLEAN DEFAULT TRUE;

ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS package_covered_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS amount_due NUMERIC(12,2) NOT NULL DEFAULT 0.00;

-- 2. TABELA PACKAGES (Produtos/Planos Comerciais)
CREATE TABLE IF NOT EXISTS public.packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    package_type TEXT NOT NULL CHECK (package_type IN ('credits', 'subscription', 'limited_period', 'unlimited')),
    billing_type TEXT NOT NULL DEFAULT 'one_time' CHECK (billing_type IN ('one_time', 'monthly', 'yearly')),
    validity_type TEXT NOT NULL DEFAULT 'days' CHECK (validity_type IN ('days', 'months', 'years')),
    validity_value INTEGER NOT NULL DEFAULT 30,
    validity_days INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_packages_org_name UNIQUE (organization_id, name)
);

-- 3. TABELA PACKAGE_ITEMS (Serviços incluídos no pacote)
CREATE TABLE IF NOT EXISTS public.package_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_package_items_pkg_svc UNIQUE (package_id, service_id)
);

-- 4. TABELA PACKAGE_RULES (Regras e Direitos do Pacote)
CREATE TABLE IF NOT EXISTS public.package_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('service_credit', 'period_limit', 'unlimited_service', 'total_limit')),
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
    limit_quantity INTEGER,
    period_type TEXT CHECK (period_type IN ('week', 'month', 'year', 'custom')),
    period_quantity INTEGER DEFAULT 1,
    is_unlimited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABELA CLIENT_PACKAGES (Pacotes/Planos Vendidos a Clientes)
CREATE TABLE IF NOT EXISTS public.client_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    original_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
    renewed_from_client_package_id UUID REFERENCES public.client_packages(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABELA CLIENT_PACKAGE_ITEMS (Snapshot dos Serviços Contratados)
CREATE TABLE IF NOT EXISTS public.client_package_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_package_id UUID NOT NULL REFERENCES public.client_packages(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
    contracted_quantity INTEGER,
    used_quantity INTEGER NOT NULL DEFAULT 0,
    remaining_quantity INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_client_pkg_items_pkg_svc UNIQUE (client_package_id, service_id)
);

-- 7. TABELA CLIENT_PACKAGE_RULES (Snapshot das Regras Contratadas)
CREATE TABLE IF NOT EXISTS public.client_package_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_package_id UUID NOT NULL REFERENCES public.client_packages(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id) ON DELETE RESTRICT,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('service_credit', 'period_limit', 'unlimited_service', 'total_limit')),
    limit_quantity INTEGER,
    period_type TEXT CHECK (period_type IN ('week', 'month', 'year', 'custom')),
    period_quantity INTEGER DEFAULT 1,
    is_unlimited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. VÍNCULO EM APPOINTMENT_SERVICES COM CLIENT_PACKAGES
ALTER TABLE public.appointment_services
    ADD COLUMN IF NOT EXISTS package_covered_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS client_package_id UUID REFERENCES public.client_packages(id) ON DELETE SET NULL;

-- 9. TABELA PACKAGE_USAGES (Auditoria de Consumo dos Pacotes nos Atendimentos)
CREATE TABLE IF NOT EXISTS public.package_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_package_id UUID NOT NULL REFERENCES public.client_packages(id) ON DELETE CASCADE,
    client_package_item_id UUID REFERENCES public.client_package_items(id) ON DELETE SET NULL,
    client_package_rule_id UUID REFERENCES public.client_package_rules(id) ON DELETE SET NULL,
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    appointment_service_id UUID NOT NULL REFERENCES public.appointment_services(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
    professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    voided_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. TABELA CLIENT_PACKAGE_PAYMENTS (Pagamentos Financeiros da Venda do Pacote)
CREATE TABLE IF NOT EXISTS public.client_package_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_package_id UUID NOT NULL REFERENCES public.client_packages(id) ON DELETE CASCADE,
    payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    installments INTEGER DEFAULT 1,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CONSTRAINTS MONETÁRIAS E REGRAS DE INTEGRIDADE DA SPRINT 4
ALTER TABLE public.packages
    DROP CONSTRAINT IF EXISTS chk_pkg_price,
    ADD CONSTRAINT chk_pkg_price CHECK (price >= 0.00),
    DROP CONSTRAINT IF EXISTS chk_pkg_val_val,
    ADD CONSTRAINT chk_pkg_val_val CHECK (validity_value > 0),
    DROP CONSTRAINT IF EXISTS chk_pkg_val_days,
    ADD CONSTRAINT chk_pkg_val_days CHECK (validity_days > 0);

ALTER TABLE public.client_packages
    DROP CONSTRAINT IF EXISTS chk_client_pkg_orig_price,
    ADD CONSTRAINT chk_client_pkg_orig_price CHECK (original_price >= 0.00),
    DROP CONSTRAINT IF EXISTS chk_client_pkg_disc,
    ADD CONSTRAINT chk_client_pkg_disc CHECK (discount >= 0.00),
    DROP CONSTRAINT IF EXISTS chk_client_pkg_disc_max,
    ADD CONSTRAINT chk_client_pkg_disc_max CHECK (discount <= original_price),
    DROP CONSTRAINT IF EXISTS chk_client_pkg_amt_paid,
    ADD CONSTRAINT chk_client_pkg_amt_paid CHECK (amount_paid >= 0.00);

ALTER TABLE public.client_package_payments
    DROP CONSTRAINT IF EXISTS chk_client_pkg_pay_amt,
    ADD CONSTRAINT chk_client_pkg_pay_amt CHECK (amount > 0.00),
    DROP CONSTRAINT IF EXISTS chk_client_pkg_pay_inst,
    ADD CONSTRAINT chk_client_pkg_pay_inst CHECK (installments >= 1);

ALTER TABLE public.package_usages
    DROP CONSTRAINT IF EXISTS chk_pkg_usage_qty,
    ADD CONSTRAINT chk_pkg_usage_qty CHECK (quantity > 0);

-- ÍNDICES DE PERFORMANCE DA SPRINT 4
CREATE INDEX IF NOT EXISTS idx_packages_org ON public.packages(organization_id);
CREATE INDEX IF NOT EXISTS idx_package_items_pkg ON public.package_items(package_id);
CREATE INDEX IF NOT EXISTS idx_package_rules_pkg ON public.package_rules(package_id);
CREATE INDEX IF NOT EXISTS idx_client_packages_org_client ON public.client_packages(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_client_packages_status ON public.client_packages(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_client_packages_exp ON public.client_packages(organization_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_client_pkg_items_pkg ON public.client_package_items(client_package_id);
CREATE INDEX IF NOT EXISTS idx_client_pkg_rules_pkg ON public.client_package_rules(client_package_id);
CREATE INDEX IF NOT EXISTS idx_package_usages_client_pkg ON public.package_usages(client_package_id);
CREATE INDEX IF NOT EXISTS idx_package_usages_app ON public.package_usages(appointment_id);
CREATE INDEX IF NOT EXISTS idx_package_usages_used_at ON public.package_usages(organization_id, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_pkg_payments_pkg ON public.client_package_payments(client_package_id);
