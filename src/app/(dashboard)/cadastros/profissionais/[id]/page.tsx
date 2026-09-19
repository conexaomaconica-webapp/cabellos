import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { ProfessionalForm } from '@/components/professionals/ProfessionalForm';
import { Professional, Service } from '@/types/database';
import { notFound } from 'next/navigation';

interface EditProfessionalPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProfessionalPage({ params }: EditProfessionalPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  const [{ data: profData }, { data: servicesData }, { data: profServicesData }] =
    await Promise.all([
      supabase
        .from('professionals')
        .select('*')
        .eq('id', id)
        .eq('organization_id', activeOrgId!)
        .single(),
      supabase
        .from('services')
        .select('*')
        .eq('organization_id', activeOrgId!)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('professional_services')
        .select('service_id')
        .eq('professional_id', id)
        .eq('organization_id', activeOrgId!),
    ]);

  if (!profData) {
    notFound();
  }

  const professional = profData as Professional;
  const services = (servicesData || []) as Service[];
  const initialSelectedServiceIds = (profServicesData || []).map((ps) => ps.service_id);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Editar Profissional</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Atualize as informações e comissões de {professional.name}
        </p>
      </div>

      <ProfessionalForm
        professional={professional}
        services={services}
        initialSelectedServiceIds={initialSelectedServiceIds}
      />
    </div>
  );
}
