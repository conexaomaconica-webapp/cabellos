'use server';

import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { PackageType, BillingType, ValidityType, RuleType, PeriodType } from '@/types/database';

export interface CreatePackagePayload {
  name: string;
  description?: string | null;
  extra_benefits?: string | null;
  price: number;
  package_type: PackageType;
  billing_type: BillingType;
  validity_type: ValidityType;
  validity_value: number;
  services: string[]; // array of service_ids
  rules: {
    rule_type: RuleType;
    service_id?: string | null;
    limit_quantity?: number | null;
    period_type?: PeriodType | null;
    period_quantity?: number;
    is_unlimited?: boolean;
  }[];
}

export async function createPackageAction(payload: CreatePackagePayload) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };
  if (!payload.name || payload.name.trim().length < 2) return { error: 'Informe o nome do pacote' };
  if (payload.price < 0) return { error: 'O preço não pode ser negativo' };
  if (!payload.services || payload.services.length === 0) return { error: 'Selecione ao menos 1 serviço' };

  // Calcular validity_days acumulados para ordenação/compatibilidade
  let validity_days = payload.validity_value;
  if (payload.validity_type === 'months') validity_days = payload.validity_value * 30;
  if (payload.validity_type === 'years') validity_days = payload.validity_value * 365;

  // 1. Criar Pacote
  const insertData: Record<string, any> = {
    organization_id: activeOrgId,
    name: payload.name.trim(),
    description: payload.description || null,
    price: payload.price,
    package_type: payload.package_type,
    billing_type: payload.billing_type,
    validity_type: payload.validity_type,
    validity_value: payload.validity_value,
    validity_days,
    is_active: true,
  };

  if (payload.extra_benefits) {
    insertData.extra_benefits = payload.extra_benefits;
  }

  let { data: pkg, error: pkgError } = await supabase
    .from('packages')
    .insert(insertData)
    .select()
    .single();

  if (pkgError && payload.extra_benefits) {
    // Fallback se a coluna extra_benefits ainda não existir no banco
    delete insertData.extra_benefits;
    const retryRes = await supabase.from('packages').insert(insertData).select().single();
    pkg = retryRes.data;
    pkgError = retryRes.error;
  }

  if (pkgError || !pkg) {
    return { error: pkgError?.message || 'Erro ao criar pacote' };
  }

  // 2. Criar Package Items (serviços incluídos)
  const itemsToInsert = payload.services.map((svcId) => ({
    organization_id: activeOrgId,
    package_id: pkg.id,
    service_id: svcId,
  }));

  const { error: itemsError } = await supabase.from('package_items').insert(itemsToInsert);
  if (itemsError) {
    return { error: itemsError.message };
  }

  // 3. Criar Package Rules
  if (payload.rules && payload.rules.length > 0) {
    const rulesToInsert = payload.rules.map((r) => ({
      organization_id: activeOrgId,
      package_id: pkg.id,
      rule_type: r.rule_type,
      service_id: r.service_id || null,
      limit_quantity: r.limit_quantity ?? null,
      period_type: r.period_type || null,
      period_quantity: r.period_quantity || 1,
      is_unlimited: r.is_unlimited || false,
    }));

    const { error: rulesError } = await supabase.from('package_rules').insert(rulesToInsert);
    if (rulesError) {
      return { error: rulesError.message };
    }
  }

  revalidatePath('/pacotes');
  return { success: true, packageId: pkg.id };
}

export async function togglePackageActiveAction(packageId: string, isActive: boolean) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const { error } = await supabase
    .from('packages')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', packageId)
    .eq('organization_id', activeOrgId);

  if (error) return { error: error.message };

  revalidatePath('/pacotes');
  return { success: true };
}

export interface SellPackagePayload {
  client_id: string;
  package_id: string;
  starts_at?: string;
  discount?: number;
  notes?: string;
  payments?: {
    payment_method_id: string;
    amount: number;
    installments?: number;
  }[];
}

export async function sellClientPackageAction(payload: SellPackagePayload) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const { data: result, error } = await supabase.rpc('sell_client_package', {
    p_data: {
      ...payload,
      organization_id: activeOrgId,
    },
  });

  if (error) return { error: error.message };

  revalidatePath('/pacotes');
  revalidatePath(`/clientes/${payload.client_id}`);
  revalidatePath('/atendimentos');
  revalidatePath('/dashboard');

  return { success: true, clientPackage: result };
}

export async function cancelClientPackageAction(clientPackageId: string, reason?: string) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const { data: result, error } = await supabase.rpc('cancel_client_package', {
    p_client_package_id: clientPackageId,
    p_reason: reason || null,
  });

  if (error) return { error: error.message };

  revalidatePath('/pacotes');
  revalidatePath('/atendimentos');
  revalidatePath('/dashboard');

  return { success: true };
}

export async function renewClientPackageAction(clientPackageId: string, paymentData?: { discount?: number; notes?: string; payments?: any[] }) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const { data: result, error } = await supabase.rpc('renew_client_package', {
    p_client_package_id: clientPackageId,
    p_payment_data: paymentData || {},
  });

  if (error) return { error: error.message };

  revalidatePath('/pacotes');
  revalidatePath('/atendimentos');
  revalidatePath('/dashboard');

  return { success: true, renewedClientPackage: result };
}

export interface PackageConfigPayload {
  allowPendingBalance: boolean;
  requireFullPayment?: boolean;
  autoNotifyExpiration?: boolean;
  expirationWarningDays?: number;
  allowShareFamily?: boolean;
}

export async function updateTenantPackageConfigAction(payload: boolean | PackageConfigPayload) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const config: PackageConfigPayload = typeof payload === 'boolean'
    ? { allowPendingBalance: payload }
    : payload;

  const updateData: Record<string, any> = {
    allow_package_usage_with_pending_balance: config.allowPendingBalance,
    updated_at: new Date().toISOString(),
  };

  if (config.requireFullPayment !== undefined) updateData.require_full_payment_for_package_usage = config.requireFullPayment;
  if (config.autoNotifyExpiration !== undefined) updateData.auto_notify_package_expiration = config.autoNotifyExpiration;
  if (config.expirationWarningDays !== undefined) updateData.package_expiration_warning_days = config.expirationWarningDays;
  if (config.allowShareFamily !== undefined) updateData.allow_package_share_family = config.allowShareFamily;

  const { error } = await supabase
    .from('organizations')
    .update(updateData)
    .eq('id', activeOrgId);

  if (error) {
    // Se falhar por colunas ainda não migradas no banco, faz o fallback salvando a regra principal
    const { error: fallbackError } = await supabase
      .from('organizations')
      .update({
        allow_package_usage_with_pending_balance: config.allowPendingBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeOrgId);

    if (fallbackError) return { error: fallbackError.message };
  }

  revalidatePath('/configuracoes');
  revalidatePath('/atendimentos');

  return { success: true };
}
