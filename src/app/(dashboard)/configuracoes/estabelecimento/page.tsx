import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { OrganizationSettingsClient } from '@/components/settings/OrganizationSettingsClient';
import { redirect } from 'next/navigation';
import { Organization } from '@/types/database';

export default async function OrganizationSettingsPage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    redirect('/dashboard');
  }

  // Obter a role do usuário no salão atual
  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('role')
    .eq('organization_id', activeOrgId)
    .single();

  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  if (!user) {
    redirect('/login');
  }

  // Apenas Admin e Master devem acessar as configs completas da org.
  const { data: profile } = await supabase.from('profiles').select('system_role').eq('id', user.id).single();
  
  if (orgUser?.role !== 'admin' && profile?.system_role !== 'master') {
    redirect('/dashboard');
  }

  // Buscar informações do salão atual
  const { data: orgData } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', activeOrgId)
    .single();

  if (!orgData) {
    redirect('/dashboard');
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações do Salão</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Personalize as informações, cores e logomarca do seu estabelecimento.
        </p>
      </div>

      <OrganizationSettingsClient 
        organization={orgData as Organization} 
        userRole={orgUser?.role || 'user'}
      />
    </div>
  );
}
