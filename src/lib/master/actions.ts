'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { processTenantBackupExport, getTenantBackupSignedUrl } from '@/lib/master/backup';
import { TenantStatus, SystemRole, FeatureKey } from '@/types/master';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

async function getMasterSupabaseClient() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignorar erros em Server Components
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Não autenticado.');
  }

  // Verificar system_role
  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single();

  if (profile?.system_role !== 'master') {
    throw new Error('Acesso negado: Somente Master da plataforma.');
  }

  return { supabase, user };
}

export async function fetchGlobalKPIs() {
  const { supabase } = await getMasterSupabaseClient();
  const { data, error } = await supabase.rpc('master_get_global_kpis');
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchOrganizations(filters?: { status?: string; q?: string }) {
  const { supabase } = await getMasterSupabaseClient();
  let query = supabase
    .from('organizations')
    .select('*, organization_subscriptions(*, saas_plans(*))')
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.q) {
    query = query.ilike('name', `%${filters.q}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchOrganizationDetail(orgId: string) {
  const { supabase } = await getMasterSupabaseClient();
  
  const [
    { data: org },
    { data: orgUsers },
    { data: subscription },
    { data: backups },
    { data: auditLogs },
  ] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).single(),
    supabase.from('organization_users').select('*, profiles(*)').eq('organization_id', orgId),
    supabase.from('organization_subscriptions').select('*, saas_plans(*)').eq('organization_id', orgId).single(),
    supabase.from('tenant_backups').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }),
    supabase.from('master_audit_logs').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(20),
  ]);

  return {
    organization: org,
    users: orgUsers || [],
    subscription,
    backups: backups || [],
    auditLogs: auditLogs || [],
  };
}

export async function masterCreateOrganizationExistingAdmin(payload: {
  name: string;
  adminUserId: string;
  saasPlanId: string;
  billingCycle?: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  state?: string;
}) {
  const { supabase } = await getMasterSupabaseClient();
  const { data, error } = await supabase.rpc('master_create_organization_existing_admin', {
    p_name: payload.name,
    p_admin_user_id: payload.adminUserId,
    p_saas_plan_id: payload.saasPlanId,
    p_billing_cycle: payload.billingCycle || 'monthly',
    p_phone: payload.phone || null,
    p_whatsapp: payload.whatsapp || null,
    p_city: payload.city || null,
    p_state: payload.state || null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function masterCreateOrganizationWithNewAdmin(payload: {
  name: string;
  adminEmail: string;
  adminPassword?: string;
  saasPlanId: string;
  billingCycle?: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  state?: string;
}) {
  const { supabase, user: masterUser } = await getMasterSupabaseClient();
  const supabaseAdmin = getSupabaseAdmin();

  // 1. Criar o usuário Auth com a API Admin do Supabase
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: payload.adminEmail,
    password: payload.adminPassword || 'Cabellos@123',
    email_confirm: true, // Já confirmar o email automaticamente
  });

  if (authError) {
    throw new Error(`Erro ao criar usuário: ${authError.message}`);
  }

  const newUserId = authData.user.id;

  // 2. Chamar a RPC já existente para criar o salão vinculando ao novo admin
  const { data, error } = await supabase.rpc('master_create_organization_existing_admin', {
    p_name: payload.name,
    p_admin_user_id: newUserId,
    p_saas_plan_id: payload.saasPlanId,
    p_billing_cycle: payload.billingCycle || 'monthly',
    p_phone: payload.phone || null,
    p_whatsapp: payload.whatsapp || null,
    p_city: payload.city || null,
    p_state: payload.state || null,
  });

  if (error) {
    // Caso dê erro na criação do salão, idealmente deveríamos apagar o usuário Auth criado,
    // mas por simplicidade e por ser admin, apenas lançamos o erro.
    throw new Error(`Erro ao criar salão: ${error.message}`);
  }
  
  return data;
}

export async function masterSetOrganizationStatus(orgId: string, newStatus: TenantStatus, reason?: string) {
  const { supabase } = await getMasterSupabaseClient();
  const { data, error } = await supabase.rpc('master_set_organization_status', {
    p_org_id: orgId,
    p_new_status: newStatus,
    p_reason: reason || null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchUsersGlobal(filters?: { role?: string; q?: string }) {
  const { supabase } = await getMasterSupabaseClient();
  let query = supabase
    .from('profiles')
    .select('*, organization_users(organization_id, role, is_active, organizations(name))')
    .order('created_at', { ascending: false });

  if (filters?.role && filters.role !== 'all') {
    query = query.eq('system_role', filters.role);
  }

  if (filters?.q) {
    query = query.or(`full_name.ilike.%${filters.q}%,email.ilike.%${filters.q}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function masterManageUserSystemRole(targetUserId: string, newRole: SystemRole) {
  const { supabase } = await getMasterSupabaseClient();
  const { data, error } = await supabase.rpc('master_manage_user_system_role', {
    p_target_user_id: targetUserId,
    p_new_role: newRole,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchSaasPlans() {
  const { supabase } = await getMasterSupabaseClient();
  const { data, error } = await supabase
    .from('saas_plans')
    .select('*, saas_plan_features(*)')
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createSaasPlan(payload: {
  name: string;
  slug: string;
  description?: string;
  monthly_price: number;
  yearly_price: number;
  trial_days: number;
  max_users: number;
  max_professionals: number;
  max_clients: number;
  features: Record<FeatureKey, boolean>;
}) {
  const { supabase, user } = await getMasterSupabaseClient();
  
  const { data: plan, error: planErr } = await supabase
    .from('saas_plans')
    .insert({
      name: payload.name,
      slug: payload.slug,
      description: payload.description || null,
      monthly_price: payload.monthly_price,
      yearly_price: payload.yearly_price,
      trial_days: payload.trial_days,
      max_users: payload.max_users,
      max_professionals: payload.max_professionals,
      max_clients: payload.max_clients,
      is_active: true,
    })
    .select()
    .single();

  if (planErr || !plan) throw new Error(planErr?.message || 'Erro ao criar plano.');

  const featureInserts = Object.entries(payload.features).map(([key, enabled]) => ({
    plan_id: plan.id,
    feature_key: key,
    enabled,
  }));

  await supabase.from('saas_plan_features').insert(featureInserts);

  await supabase.from('master_audit_logs').insert({
    master_user_id: user.id,
    action: 'create_saas_plan',
    entity_type: 'saas_plan',
    entity_id: plan.id,
    after_data: { name: payload.name, slug: payload.slug },
  });

  return plan;
}

export async function updateSaasPlan(planId: string, payload: {
  name: string;
  slug: string;
  description?: string;
  monthly_price: number;
  yearly_price: number;
  trial_days: number;
  max_users: number;
  max_professionals: number;
  max_clients: number;
  features: Record<FeatureKey, boolean>;
}) {
  const { supabase, user } = await getMasterSupabaseClient();
  
  const { error: planErr } = await supabase
    .from('saas_plans')
    .update({
      name: payload.name,
      slug: payload.slug,
      description: payload.description || null,
      monthly_price: payload.monthly_price,
      yearly_price: payload.yearly_price,
      trial_days: payload.trial_days,
      max_users: payload.max_users,
      max_professionals: payload.max_professionals,
      max_clients: payload.max_clients,
    })
    .eq('id', planId);

  if (planErr) throw new Error(planErr.message || 'Erro ao atualizar plano.');

  // Delete all existing features and re-insert (easiest way to sync)
  await supabase.from('saas_plan_features').delete().eq('plan_id', planId);

  const featureInserts = Object.entries(payload.features).map(([key, enabled]) => ({
    plan_id: planId,
    feature_key: key,
    enabled,
  }));
  await supabase.from('saas_plan_features').insert(featureInserts);

  await supabase.from('master_audit_logs').insert({
    master_user_id: user.id,
    action: 'update_saas_plan',
    entity_type: 'saas_plan',
    entity_id: planId,
    details: payload,
  });

  return { success: true };
}

export async function toggleSaasPlanStatus(planId: string, isActive: boolean) {
  const { supabase, user } = await getMasterSupabaseClient();
  const { error } = await supabase.from('saas_plans').update({ is_active: isActive }).eq('id', planId);
  if (error) throw new Error(error.message);
  
  await supabase.from('master_audit_logs').insert({
    master_user_id: user.id,
    action: isActive ? 'activate_saas_plan' : 'deactivate_saas_plan',
    entity_type: 'saas_plan',
    entity_id: planId,
  });
  
  return { success: true };
}

export async function deleteSaasPlan(planId: string) {
  const { supabase, user } = await getMasterSupabaseClient();
  const { error } = await supabase.from('saas_plans').delete().eq('id', planId);
  if (error) throw new Error(`Erro ao excluir plano: ${error.message}`);
  
  await supabase.from('master_audit_logs').insert({
    master_user_id: user.id,
    action: 'delete_saas_plan',
    entity_type: 'saas_plan',
    entity_id: planId,
  });
  
  return { success: true };
}

export async function fetchSubscriptions() {
  const { supabase } = await getMasterSupabaseClient();
  const { data, error } = await supabase
    .from('organization_subscriptions')
    .select('*, organizations(name, status), saas_plans(name, slug)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchBackupsList() {
  const { supabase } = await getMasterSupabaseClient();
  const { data, error } = await supabase
    .from('tenant_backups')
    .select('*, organizations(name), profiles!tenant_backups_requested_by_fkey(email, name)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function triggerTenantBackupAction(organizationId: string) {
  const { supabase, user } = await getMasterSupabaseClient();
  return await processTenantBackupExport(supabase, user.id, organizationId);
}

export async function downloadBackupUrlAction(backupId: string) {
  const { supabase, user } = await getMasterSupabaseClient();
  return await getTenantBackupSignedUrl(supabase, user.id, backupId);
}

export async function fetchMasterAuditLogs(filters?: { action?: string; q?: string }) {
  const { supabase } = await getMasterSupabaseClient();
  let query = supabase
    .from('master_audit_logs')
    .select('*, profiles!master_audit_logs_master_user_id_fkey(name, email), organizations(name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters?.action && filters.action !== 'all') {
    query = query.eq('action', filters.action);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchPlatformSettings() {
  const { supabase } = await getMasterSupabaseClient();
  const { data, error } = await supabase.from('platform_settings').select('*');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function updatePlatformSetting(key: string, value: unknown) {
  const { supabase, user } = await getMasterSupabaseClient();
  const { data: oldSetting } = await supabase.from('platform_settings').select('*').eq('key', key).single();

  const { data, error } = await supabase
    .from('platform_settings')
    .update({ value: JSON.stringify(value), updated_at: new Date().toISOString(), updated_by: user.id })
    .eq('key', key)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from('master_audit_logs').insert({
    master_user_id: user.id,
    action: 'update_platform_setting',
    entity_type: 'platform_setting',
    entity_id: null,
    before_data: { key, value: oldSetting?.value },
    after_data: { key, value },
  });

  return data;
}
