import { createClient, getActiveOrganizationId, getMasterRolePreview } from '@/lib/supabase/server';
import { Sidebar } from '@/components/shared/Sidebar';
import { Header } from '@/components/shared/Header';
import { redirect } from 'next/navigation';
import { OrganizationUser, Organization } from '@/types/database';
import { getSystemBrandingAction } from '@/lib/master/system-assets';

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

  const activeOrgUser = orgUsers.find((ou) => ou.organization_id === activeOrgId);
  const activeOrg = (activeOrgUser?.organization || orgUsers[0].organization) as Organization;
  const userRole = activeOrgUser?.role || 'admin';
  const hasOrgMembership = !!activeOrgUser;

  // Buscar perfil do usuário
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar_url, email, system_role')
    .eq('id', user.id)
    .single();

  const userName = profile?.name || user.email?.split('@')[0] || 'Usuário';
  const userEmail = user.email || profile?.email || '';
  const userAvatar = profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
  const systemRole = profile?.system_role || 'user';

  // Obter simulação de papel (exclusiva para Master)
  const rawPreview = await getMasterRolePreview();
  const previewRole = systemRole === 'master' ? rawPreview : null;

  const systemBranding = await getSystemBrandingAction();

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200"
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
        systemRole={systemRole}
        userRole={userRole}
        previewRole={previewRole}
        hasOrgMembership={hasOrgMembership}
        systemBranding={systemBranding}
      />

      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <Header
          organization={activeOrg}
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
          userAvatar={userAvatar}
          systemRole={systemRole}
          previewRole={previewRole}
          hasOrgMembership={hasOrgMembership}
          systemBranding={systemBranding}
        />

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
