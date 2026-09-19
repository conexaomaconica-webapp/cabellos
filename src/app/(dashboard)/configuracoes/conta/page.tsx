import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { AccountSettingsClient } from '@/components/settings/AccountSettingsClient';
import { redirect } from 'next/navigation';

export default async function AccountSettingsPage() {
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

  // Buscar informações do plano/assinatura atual
  let subscriptionData = null;
  try {
    const { data, error } = await supabase.rpc('get_current_subscription', { p_org_id: activeOrgId });
    if (!error && data) {
      subscriptionData = data;
    }
  } catch (err) {
    console.error('Failed to get subscription', err);
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Minha Conta & Assinatura</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gerencie suas informações de acesso e visualize os detalhes do seu plano atual.
        </p>
      </div>

      <AccountSettingsClient 
        userEmail={user.email || ''} 
        userRole={orgUser?.role || 'user'}
        subscriptionData={subscriptionData}
      />
    </div>
  );
}
