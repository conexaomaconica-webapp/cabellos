-- Migration 1: Initial Schema for Cabellos SaaS Multi-tenant
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#0f172a',
    secondary_color TEXT DEFAULT '#64748b',
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    instagram TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    currency TEXT DEFAULT 'BRL',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PROFILES (Identidade Global do Usuário)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ORGANIZATION_USERS (Vínculo e Papel por Tenant)
CREATE TABLE IF NOT EXISTS public.organization_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'professional', 'receptionist')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_organization_user UNIQUE (organization_id, user_id)
);

-- 4. CLIENTS (SEM DELETE físico no MVP)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    birth_date DATE,
    gender TEXT,
    notes TEXT,
    preferred_professional_id UUID,
    preferred_service_id UUID,
    custom_return_interval_days INTEGER,
    return_rule_mode TEXT DEFAULT 'auto',
    average_return_days NUMERIC(5,2),
    next_expected_return_at TIMESTAMPTZ,
    first_appointment_at TIMESTAMPTZ,
    last_appointment_at TIMESTAMPTZ,
    total_appointments INTEGER DEFAULT 0,
    total_spent NUMERIC(12,2) DEFAULT 0.00,
    average_ticket NUMERIC(12,2) DEFAULT 0.00,
    last_contact_at TIMESTAMPTZ,
    allow_whatsapp BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PROFESSIONALS
CREATE TABLE IF NOT EXISTS public.professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    photo_url TEXT,
    commission_type TEXT DEFAULT 'none' CHECK (commission_type IN ('none', 'percentage', 'fixed', 'custom')),
    commission_value NUMERIC(12,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Foreign Key para clientes preferred_professional
ALTER TABLE public.clients
    DROP CONSTRAINT IF EXISTS fk_clients_preferred_professional,
    ADD CONSTRAINT fk_clients_preferred_professional
    FOREIGN KEY (preferred_professional_id) REFERENCES public.professionals(id) ON DELETE SET NULL;

-- 6. SERVICE_CATEGORIES
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3b82f6',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_service_categories_org_name UNIQUE (organization_id, name)
);

-- 7. SERVICES
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    default_return_interval_days INTEGER DEFAULT 15,
    counts_for_return_frequency BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_services_org_name UNIQUE (organization_id, name)
);

ALTER TABLE public.clients
    DROP CONSTRAINT IF EXISTS fk_clients_preferred_service,
    ADD CONSTRAINT fk_clients_preferred_service
    FOREIGN KEY (preferred_service_id) REFERENCES public.services(id) ON DELETE SET NULL;

-- 8. PROFESSIONAL_SERVICES (Com organization_id explícito)
CREATE TABLE IF NOT EXISTS public.professional_services (
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    custom_price NUMERIC(12,2),
    custom_commission NUMERIC(12,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, professional_id, service_id)
);

-- ÍNDICES RECOMENDADOS
CREATE INDEX IF NOT EXISTS idx_organization_users_user ON public.organization_users(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_org ON public.organization_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_org ON public.clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(organization_id, phone);
CREATE INDEX IF NOT EXISTS idx_clients_whatsapp ON public.clients(organization_id, whatsapp);
CREATE INDEX IF NOT EXISTS idx_professionals_org ON public.professionals(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_org ON public.service_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_services_org ON public.services(organization_id);
CREATE INDEX IF NOT EXISTS idx_prof_services_org ON public.professional_services(organization_id);
