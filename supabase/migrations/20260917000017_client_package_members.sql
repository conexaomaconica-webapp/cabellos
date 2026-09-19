-- Migration 17: Support Family/Multiple Beneficiaries in Client Packages (Planos Familiares)
CREATE TABLE IF NOT EXISTS public.client_package_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_package_id UUID NOT NULL REFERENCES public.client_packages(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    relationship_type TEXT DEFAULT 'dependent', -- 'holder', 'spouse', 'child', 'dependent', 'other'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_client_pkg_member UNIQUE (client_package_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_pkg_members_pkg ON public.client_package_members(client_package_id);
CREATE INDEX IF NOT EXISTS idx_client_pkg_members_client ON public.client_package_members(organization_id, client_id);
