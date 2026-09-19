import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { ProfessionalForm } from '@/components/professionals/ProfessionalForm';
import { Service } from '@/types/database';

export default async function NewProfessionalPage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  const { data: servicesData } = await supabase
    .from('services')
    .select('*')
    .eq('organization_id', activeOrgId!)
    .eq('is_active', true)
    .order('name');

  const services = (servicesData || []) as Service[];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Cadastrar Profissional</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Adicione um novo membro da equipe e seus serviços prestados
        </p>
      </div>

      <ProfessionalForm services={services} />
    </div>
  );
}
