-- Migration 6: Corrections for Sprint 2 (Partial Payment Rules & Professional RLS Visibility)

-- 1. POLÍTICAS RLS DE SELECT PARA ATENDIMENTOS E SUBTABELAS
-- Donos, Admins e Recepcionistas podem consultar todos os atendimentos da organização ativa.
-- Profissionais (role 'professional') conseguem consultar SOMENTE atendimentos em que estejam envolvidos
-- (seja como profissional principal ou prestador de serviço de algum item).

DROP POLICY IF EXISTS "RLS Select appointments" ON public.appointments;
CREATE POLICY "RLS Select appointments" ON public.appointments FOR SELECT USING (
    public.user_has_org_role(organization_id, ARRAY['owner', 'admin', 'receptionist'])
    OR (
        public.user_has_org_role(organization_id, ARRAY['professional'])
        AND (
            professional_id IN (
                SELECT professionals.id FROM public.professionals WHERE user_id = auth.uid() AND organization_id = appointments.organization_id AND is_active = TRUE
            )
            OR appointments.id IN (
                SELECT appointment_id FROM public.appointment_services aps
                JOIN public.professionals p ON p.id = aps.professional_id
                WHERE p.user_id = auth.uid() AND p.organization_id = appointments.organization_id AND p.is_active = TRUE
            )
        )
    )
);

DROP POLICY IF EXISTS "RLS Select appointment_services" ON public.appointment_services;
CREATE POLICY "RLS Select appointment_services" ON public.appointment_services FOR SELECT USING (
    public.user_has_org_role(organization_id, ARRAY['owner', 'admin', 'receptionist'])
    OR (
        public.user_has_org_role(organization_id, ARRAY['professional'])
        AND (
            professional_id IN (
                SELECT professionals.id FROM public.professionals WHERE user_id = auth.uid() AND organization_id = appointment_services.organization_id AND is_active = TRUE
            )
            OR appointment_id IN (
                SELECT a.id FROM public.appointments a
                JOIN public.professionals p ON p.id = a.professional_id
                WHERE p.user_id = auth.uid() AND p.organization_id = appointment_services.organization_id AND p.is_active = TRUE
            )
        )
    )
);

DROP POLICY IF EXISTS "RLS Select appointment_payments" ON public.appointment_payments;
CREATE POLICY "RLS Select appointment_payments" ON public.appointment_payments FOR SELECT USING (
    public.user_has_org_role(organization_id, ARRAY['owner', 'admin', 'receptionist'])
    OR (
        public.user_has_org_role(organization_id, ARRAY['professional'])
        AND appointment_id IN (
            SELECT appointments.id FROM public.appointments
            WHERE organization_id = appointment_payments.organization_id
              AND (
                professional_id IN (
                    SELECT professionals.id FROM public.professionals WHERE user_id = auth.uid() AND organization_id = appointment_payments.organization_id AND is_active = TRUE
                )
                OR appointments.id IN (
                    SELECT appointment_id FROM public.appointment_services aps
                    JOIN public.professionals p ON p.id = aps.professional_id
                    WHERE p.user_id = auth.uid() AND p.organization_id = appointment_payments.organization_id AND p.is_active = TRUE
                )
              )
        )
    )
);
