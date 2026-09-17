import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { ServiceForm } from '@/components/services/ServiceForm';
import { ServiceCategory } from '@/types/database';

export default async function NewServicePage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  const { data: categoriesData } = await supabase
    .from('service_categories')
    .select('*')
    .eq('organization_id', activeOrgId!)
    .order('sort_order', { ascending: true });

  const categories = (categoriesData || []) as ServiceCategory[];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Cadastrar Serviço</h1>
        <p className="text-sm text-slate-400 mt-1">
          Informe o nome, preço, duração e categoria do novo serviço
        </p>
      </div>

      <ServiceForm categories={categories} />
    </div>
  );
}
