import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { ClientForm } from '@/components/clients/ClientForm';
import { Professional, Service } from '@/types/database';

export default async function NewClientPage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  const [{ data: professionalsData }, { data: servicesData }] = await Promise.all([
    supabase
      .from('professionals')
      .select('*')
      .eq('organization_id', activeOrgId!)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('services')
      .select('*')
      .eq('organization_id', activeOrgId!)
      .eq('is_active', true)
      .order('name'),
  ]);

  const professionals = (professionalsData || []) as Professional[];
  const services = (servicesData || []) as Service[];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Cadastrar Novo Cliente</h1>
        <p className="text-sm text-slate-400 mt-1">
          Adicione as informações de contato e preferências do cliente
        </p>
      </div>

      <ClientForm professionals={professionals} services={services} />
    </div>
  );
}
