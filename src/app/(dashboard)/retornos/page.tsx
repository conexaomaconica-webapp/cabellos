import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { getReturnAlertsAction, getInactiveClientsAction } from './actions';
import { getMessageTemplatesAction } from '../configuracoes/actions';
import { ReturnsClient } from '@/components/returns/ReturnsClient';

export default async function RetornosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab || 'hoje';

  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  const [
    { data: alerts },
    { data: templates },
    { data: activeOrg },
    { data: inactiveClients },
  ] = await Promise.all([
    getReturnAlertsAction(tab),
    getMessageTemplatesAction(),
    supabase.from('organizations').select('name').eq('id', activeOrgId!).single(),
    tab === 'inativos' ? getInactiveClientsAction() : Promise.resolve({ data: [] }),
  ]);

  return (
    <ReturnsClient
      initialTab={tab}
      alerts={alerts || []}
      templates={templates || []}
      orgName={activeOrg?.name || 'Salão'}
      inactiveClients={inactiveClients || []}
    />
  );
}
