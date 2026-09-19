import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { Service } from '@/types/database';
import { PackageForm } from './package-form';
import Link from 'next/link';

export default async function NewPackagePage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    return <div className="p-6 text-red-600 font-medium">Selecione uma organização no menu superior.</div>;
  }

  const { data: rawServices } = await supabase
    .from('services')
    .select('*')
    .eq('organization_id', activeOrgId)
    .eq('is_active', true)
    .order('name');

  const services: Service[] = (rawServices || []) as any;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b pb-4 border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Novo Pacote ou Plano</h1>
          <p className="text-sm text-slate-400 mt-1">Configure as regras de utilização, validade, serviços e precificação do seu produto comercial.</p>
        </div>
        <Link href="/pacotes" className="text-sm text-slate-400 hover:text-slate-200">
          ← Voltar para Pacotes
        </Link>
      </div>

      <PackageForm services={services} />
    </div>
  );
}
