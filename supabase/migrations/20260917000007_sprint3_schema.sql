-- Migration 7: Schema for Sprint 3 (Central de Retornos e Engajamento)

-- 1. ADICIONAR COLUNAS DE CONFIGURAÇÃO DE RETORNO EM ORGANIZATIONS
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS default_return_interval_days INT NOT NULL DEFAULT 20,
ADD COLUMN IF NOT EXISTS minimum_visits_for_average INT NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS alert_lead_days INT NOT NULL DEFAULT 7,
ADD COLUMN IF NOT EXISTS inactive_client_days INT NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS auto_create_alerts BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. TABELA CLIENT_SERVICE_FREQUENCIES
CREATE TABLE IF NOT EXISTS public.client_service_frequencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    last_professional_id UUID NULL REFERENCES public.professionals(id) ON DELETE SET NULL,
    visit_count INT NOT NULL DEFAULT 0,
    first_service_at TIMESTAMPTZ NULL,
    last_service_at TIMESTAMPTZ NULL,
    average_interval_days NUMERIC(6,1) NULL,
    manual_interval_days INT NULL,
    effective_interval_days INT NULL,
    next_expected_return_at DATE NULL,
    calculation_mode TEXT NOT NULL DEFAULT 'global_default', -- manual, automatic, service_default, global_default
    confidence_level TEXT NOT NULL DEFAULT 'low',           -- low, medium, high
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_client_service_freq UNIQUE (organization_id, client_id, service_id)
);

-- Índices para otimização de consultas
CREATE INDEX IF NOT EXISTS idx_csf_client ON public.client_service_frequencies(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_csf_prof ON public.client_service_frequencies(organization_id, last_professional_id);

-- 3. TABELA RETURN_ALERTS
CREATE TABLE IF NOT EXISTS public.return_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    client_service_frequency_id UUID NULL REFERENCES public.client_service_frequencies(id) ON DELETE SET NULL,
    expected_return_at DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'upcoming', -- upcoming, due, overdue, contacted, snoozed, returned, ignored, scheduled
    days_overdue INT NOT NULL DEFAULT 0,
    snoozed_until DATE NULL,
    snooze_reason TEXT NULL,
    contacted_at TIMESTAMPTZ NULL,
    resolved_at TIMESTAMPTZ NULL,
    resolution TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevenção de duplicidade para alertas ativos no mesmo ciclo
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_active_return_alert 
ON public.return_alerts(organization_id, client_id, service_id, expected_return_at) 
WHERE status IN ('upcoming', 'due', 'overdue', 'snoozed');

CREATE INDEX IF NOT EXISTS idx_alerts_org_status ON public.return_alerts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_expected ON public.return_alerts(organization_id, expected_return_at);

-- 4. TABELA MESSAGE_TEMPLATES
CREATE TABLE IF NOT EXISTS public.message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- return_reminder, overdue, inactive_client, package_renewal, birthday, custom
    content TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_org ON public.message_templates(organization_id, type);

-- 5. TABELA CLIENT_CONTACTS
CREATE TABLE IF NOT EXISTS public.client_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    service_id UUID NULL REFERENCES public.services(id) ON DELETE SET NULL,
    return_alert_id UUID NULL REFERENCES public.return_alerts(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_type TEXT NOT NULL, -- whatsapp, phone, instagram, in_person, other
    message_template_id UUID NULL REFERENCES public.message_templates(id) ON DELETE SET NULL,
    message_content TEXT NOT NULL,
    contacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    result TEXT NOT NULL, -- sent, no_response, interested, scheduled, declined, returned
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_client ON public.client_contacts(organization_id, client_id);
