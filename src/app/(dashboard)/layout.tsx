import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { Sidebar } from '@/components/shared/Sidebar';
import { Header } from '@/components/shared/Header';
import { redirect } from 'next/navigation';
import { OrganizationUser, Organization } from '@/types/database';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  // Buscar organizações às quais o usuário pertence
  const { data: orgUsersData } = await supabase
    .from('organization_users')
    .select('*, organization:organizations(*)')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const orgUsers = (orgUsersData || []) as OrganizationUser[];

  if (orgUsers.length === 0) {
    return redirect('/onboarding');
  }

  // Resolver ID da organização ativa
  let activeOrgId = await getActiveOrganizationId();
  if (!activeOrgId || !orgUsers.some((ou) => ou.organization_id === activeOrgId)) {
    activeOrgId = orgUsers[0].organization_id;
  }

  const activeOrg = (orgUsers.find((ou) => ou.organization_id === activeOrgId)?.organization ||
    orgUsers[0].organization) as Organization;

  // Buscar perfil do usuário
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single();

  const userName = profile?.name || user.email?.split('@')[0] || 'Usuário';

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row bg-slate-950 text-slate-100"
      style={
        {
          '--primary-color': activeOrg?.primary_color || '#0f172a',
          '--secondary-color': activeOrg?.secondary_color || '#64748b',
        } as React.CSSProperties
      }
    >
      <Sidebar
        organizations={orgUsers}
        activeOrgId={activeOrgId}
        userName={userName}
      />

      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <Header organization={activeOrg} userName={userName} />

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
