import { SupabaseClient } from '@supabase/supabase-js';
import { FeatureKey } from '@/types/master';

export interface LimitCheckResult {
  allowed: boolean;
  currentCount: number;
  maxLimit: number;
  message?: string;
}

export interface FeatureCheckResult {
  allowed: boolean;
  featureKey: FeatureKey;
  message?: string;
}

/**
 * Consulta os dados da assinatura e limites vigentes do tenant via RPC ou query direta.
 */
export async function getTenantCurrentSubscription(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.rpc('get_current_subscription', {
    p_org_id: orgId,
  });

  if (error || !data) {
    // Fallback gracioso se a RPC não retornar ou se for plano ilimitado
    return {
      has_subscription: false,
      plan: { max_users: 9999, max_professionals: 9999, max_clients: 999999 },
      features: {
        financial_module: true,
        reports_module: true,
        packages_module: true,
        returns_module: true,
        csv_export: true,
        advanced_reports: true,
      },
    };
  }

  return data;
}

/**
 * Verifica se a quantidade atual de profissionais no tenant respeita o limite do plano.
 */
export async function checkTenantProfessionalLimit(
  supabase: SupabaseClient,
  orgId: string
): Promise<LimitCheckResult> {
  const subData = await getTenantCurrentSubscription(supabase, orgId);
  const maxLimit = subData.plan?.max_professionals ?? 9999;

  const { count, error } = await supabase
    .from('professionals')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('is_active', true);

  const currentCount = count || 0;
  const allowed = currentCount < maxLimit;

  return {
    allowed,
    currentCount,
    maxLimit,
    message: allowed
      ? undefined
      : `Seu plano permite até ${maxLimit} profissionais. Faça upgrade no suporte para adicionar novos.`,
  };
}

/**
 * Verifica se a quantidade atual de usuários no tenant respeita o limite do plano.
 */
export async function checkTenantUserLimit(
  supabase: SupabaseClient,
  orgId: string
): Promise<LimitCheckResult> {
  const subData = await getTenantCurrentSubscription(supabase, orgId);
  const maxLimit = subData.plan?.max_users ?? 9999;

  const { count } = await supabase
    .from('organization_users')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('is_active', true);

  const currentCount = count || 0;
  const allowed = currentCount < maxLimit;

  return {
    allowed,
    currentCount,
    maxLimit,
    message: allowed
      ? undefined
      : `Seu plano permite até ${maxLimit} usuários. Faça upgrade para adicionar novos usuários.`,
  };
}

/**
 * Verifica se a quantidade atual de clientes no tenant respeita o limite do plano.
 */
export async function checkTenantClientLimit(
  supabase: SupabaseClient,
  orgId: string
): Promise<LimitCheckResult> {
  const subData = await getTenantCurrentSubscription(supabase, orgId);
  const maxLimit = subData.plan?.max_clients ?? 999999;

  const { count } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);

  const currentCount = count || 0;
  const allowed = currentCount < maxLimit;

  return {
    allowed,
    currentCount,
    maxLimit,
    message: allowed
      ? undefined
      : `Seu plano permite até ${maxLimit} clientes cadastrados. Faça upgrade para ampliar sua base.`,
  };
}

/**
 * Verifica se um recurso/feature está habilitado no plano do tenant.
 */
export async function checkTenantFeatureAccess(
  supabase: SupabaseClient,
  orgId: string,
  featureKey: FeatureKey
): Promise<FeatureCheckResult> {
  const subData = await getTenantCurrentSubscription(supabase, orgId);
  const enabled = subData.features?.[featureKey] ?? true;

  return {
    allowed: Boolean(enabled),
    featureKey,
    message: enabled
      ? undefined
      : `O módulo "${featureKey}" não está incluído no seu plano atual.`,
  };
}
