import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { ServiceForm } from '@/components/services/ServiceForm';
import { Service, ServiceCategory } from '@/types/database';
import { notFound } from 'next/navigation';

interface EditServicePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditServicePage({ params }: EditServicePageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  const [{ data: serviceData }, { data: categoriesData }] = await Promise.all([
    supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .eq('organization_id', activeOrgId!)
      .single(),
    supabase
      .from('service_categories')
      .select('*')
      .eq('organization_id', activeOrgId!)
      .order('sort_order', { ascending: true }),
  ]);

  if (!serviceData) {
    notFound();
  }

  const service = serviceData as Service;
  const categories = (categoriesData || []) as ServiceCategory[];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Editar Serviço</h1>
        <p className="text-sm text-slate-400 mt-1">
          Atualize os dados e preços de {service.name}
        </p>
      </div>

      <ServiceForm service={service} categories={categories} />
    </div>
  );
}
