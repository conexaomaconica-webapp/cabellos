-- Migration 4: Sprint 2 Schema (Payment Methods, Appointments, Appointment Services, Appointment Payments)

-- 1. PAYMENT_METHODS
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cash', 'pix', 'debit_card', 'credit_card', 'transfer', 'package', 'other')),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_methods_org_name UNIQUE (organization_id, name)
);

-- 2. APPOINTMENTS
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
    notes TEXT,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. APPOINTMENT_SERVICES
CREATE TABLE IF NOT EXISTS public.appointment_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
    professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    commission_amount NUMERIC(12,2) DEFAULT 0.00,
    counts_for_return_frequency BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. APPOINTMENT_PAYMENTS
CREATE TABLE IF NOT EXISTS public.appointment_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    installments INTEGER DEFAULT 1,
    notes TEXT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CONSTRAINTS MONETÁRIAS E REGRAS DE INTEGRIDADE
ALTER TABLE public.appointment_services
    DROP CONSTRAINT IF EXISTS chk_app_svc_qty,
    ADD CONSTRAINT chk_app_svc_qty CHECK (quantity > 0),
    DROP CONSTRAINT IF EXISTS chk_app_svc_price,
    ADD CONSTRAINT chk_app_svc_price CHECK (unit_price >= 0.00),
    DROP CONSTRAINT IF EXISTS chk_app_svc_disc,
    ADD CONSTRAINT chk_app_svc_disc CHECK (discount >= 0.00),
    DROP CONSTRAINT IF EXISTS chk_app_svc_total,
    ADD CONSTRAINT chk_app_svc_total CHECK (total >= 0.00),
    DROP CONSTRAINT IF EXISTS chk_app_svc_disc_max,
    ADD CONSTRAINT chk_app_svc_disc_max CHECK (discount <= (quantity * unit_price));

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS chk_app_subtotal,
    ADD CONSTRAINT chk_app_subtotal CHECK (subtotal >= 0.00),
    DROP CONSTRAINT IF EXISTS chk_app_disc,
    ADD CONSTRAINT chk_app_disc CHECK (discount >= 0.00),
    DROP CONSTRAINT IF EXISTS chk_app_total,
    ADD CONSTRAINT chk_app_total CHECK (total >= 0.00),
    DROP CONSTRAINT IF EXISTS chk_app_disc_max,
    ADD CONSTRAINT chk_app_disc_max CHECK (discount <= subtotal);

ALTER TABLE public.appointment_payments
    DROP CONSTRAINT IF EXISTS chk_app_pay_amount,
    ADD CONSTRAINT chk_app_pay_amount CHECK (amount > 0.00),
    DROP CONSTRAINT IF EXISTS chk_app_pay_installments,
    ADD CONSTRAINT chk_app_pay_installments CHECK (installments >= 1);

-- INDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_appointments_org_date ON public.appointments(organization_id, appointment_date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON public.appointments(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_prof ON public.appointments(organization_id, professional_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_appointment_services_app ON public.appointment_services(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_payments_app ON public.appointment_payments(appointment_id);
