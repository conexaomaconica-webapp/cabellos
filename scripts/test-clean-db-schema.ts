import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhYmVsbG9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY3MjUxMjAwMCwiZXhwIjoyMDA4MDg4MDAwfQ.placeholder';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runCleanDbAudit() {
  console.log('=== AUDITORIA DE SEGURANÇA E BANCO LIMPO (CABELLOS) ===\n');

  let totalPassed = 0;
  let totalFailed = 0;

  function assertTest(name: string, condition: boolean, details: string) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      console.log(`       Detalhes: ${details}`);
      totalPassed++;
    } else {
      console.error(`[FAIL] ${name}`);
      console.error(`       Detalhes: ${details}`);
      totalFailed++;
    }
  }

  try {
    // 1. Audit organization_users roles
    const { data: rolesData, error: rolesErr } = await supabase
      .from('organization_users')
      .select('role');
    
    if (rolesErr) {
      assertTest('Item 1: Papéis Finais em organization_users', false, `Erro ao consultar: ${rolesErr.message}`);
    } else {
      const distinctRoles = Array.from(new Set(rolesData?.map(r => r.role) || []));
      const hasOwner = distinctRoles.includes('owner');
      const validRoles = distinctRoles.every(r => ['admin', 'receptionist', 'professional'].includes(r));
      assertTest(
        'Item 1: Papéis Finais em organization_users',
        !hasOwner && validRoles,
        `Papéis encontrados: ${distinctRoles.join(', ') || 'Nenhum'}. Zero "owner".`
      );
    }

    // 2. Audit system_role in profiles
    const { data: sysRolesData, error: sysRolesErr } = await supabase
      .from('profiles')
      .select('system_role');

    if (sysRolesErr) {
      assertTest('Item 8: Papéis Finais de Sistema em profiles', false, `Erro ao consultar: ${sysRolesErr.message}`);
    } else {
      const distinctSysRoles = Array.from(new Set(sysRolesData?.map(r => r.system_role) || []));
      const validSysRoles = distinctSysRoles.every(r => ['master', 'user'].includes(r));
      assertTest(
        'Item 8: Papéis Finais de Sistema em profiles',
        validSysRoles,
        `Papéis de sistema encontrados: ${distinctSysRoles.join(', ')}.`
      );
    }

    // 3. Audit System Assets presence
    const { data: assetsData, error: assetsErr } = await supabase
      .from('system_assets')
      .select('id')
      .limit(1);

    assertTest(
      'Item 11: Presença da tabela system_assets',
      !assetsErr,
      assetsErr ? `Erro: ${assetsErr.message}` : 'Tabela public.system_assets existe e responde a consultas.'
    );

    // 4. Test Onboarding RPC (create_organization_with_admin creates role = admin)
    const { data: testOrg, error: orgErr } = await supabase.rpc(
      'create_organization_with_admin',
      {
        p_name: 'Salão Audit Test',
        p_phone: '11999998888',
        p_whatsapp: '11999998888',
        p_primary_color: '#0f172a',
        p_secondary_color: '#64748b',
        p_logo_url: null,
      }
    );

    if (orgErr || !testOrg?.id) {
      assertTest('Item 7: Chamada oficial create_organization_with_admin', false, `Erro na RPC: ${orgErr?.message}`);
    } else {
      const { data: userRoleData } = await supabase
        .from('organization_users')
        .select('role')
        .eq('organization_id', testOrg.id)
        .single();

      assertTest(
        'Item 7: Chamada oficial create_organization_with_admin',
        userRoleData?.role === 'admin',
        `Organização criada (${testOrg.id}) com vinculo role = "${userRoleData?.role}".`
      );

      // Limpeza do salão de teste
      await supabase.from('organizations').delete().eq('id', testOrg.id);
    }

    console.log(`\n======================================================`);
    console.log(`STATUS AUDITORIA DE BANCO LIMPO: ${totalFailed === 0 ? 'PASS' : 'FAIL'} (${totalPassed}/${totalPassed + totalFailed} Testes)`);
    console.log(`======================================================\n`);

    if (totalFailed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Erro crítico na auditoria:', err);
    process.exit(1);
  }
}

runCleanDbAudit();
