'use server';

import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getMessageTemplatesAction() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { data: [], error: 'Organização não selecionada' };

  const { data, error } = await supabase
    .from('message_templates')
    .select('*')
    .eq('organization_id', activeOrgId)
    .order('created_at', { ascending: true });

  if (error) return { data: [], error: error.message };

  return { data: data || [], error: null };
}

export interface SaveTemplatePayload {
  id?: string;
  name: string;
  type: 'return_reminder' | 'overdue' | 'inactive_client' | 'package_renewal' | 'birthday' | 'custom';
  content: string;
  is_default?: boolean;
}

export async function saveMessageTemplateAction(payload: SaveTemplatePayload) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  if (payload.id) {
    const { error } = await supabase
      .from('message_templates')
      .update({
        name: payload.name,
        type: payload.type,
        content: payload.content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.id)
      .eq('organization_id', activeOrgId);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('message_templates').insert({
      organization_id: activeOrgId,
      name: payload.name,
      type: payload.type,
      content: payload.content,
      is_default: payload.is_default || false,
      is_active: true,
    });

    if (error) return { error: error.message };
  }

  revalidatePath('/configuracoes/mensagens');
  return { success: true };
}

// Soft delete (desativação lógica preservando histórico)
export async function toggleMessageTemplateStatusAction(templateId: string, isActive: boolean) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const { error } = await supabase
    .from('message_templates')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)
    .eq('organization_id', activeOrgId);

  if (error) return { error: error.message };

  revalidatePath('/configuracoes/mensagens');
  return { success: true };
}

export async function getReturnSettingsAction() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { data: null, error: 'Organização não selecionada' };

  const { data, error } = await supabase
    .from('organizations')
    .select('default_return_interval_days, minimum_visits_for_average, alert_lead_days, inactive_client_days, auto_create_alerts')
    .eq('id', activeOrgId)
    .single();

  if (error) return { data: null, error: error.message };

  return { data, error: null };
}

export interface ReturnSettingsPayload {
  default_return_interval_days: number;
  minimum_visits_for_average: number;
  alert_lead_days: number;
  inactive_client_days: number;
  auto_create_alerts: boolean;
}

export async function updateReturnSettingsAction(payload: ReturnSettingsPayload) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const { error } = await supabase
    .from('organizations')
    .update({
      default_return_interval_days: payload.default_return_interval_days,
      minimum_visits_for_average: payload.minimum_visits_for_average,
      alert_lead_days: payload.alert_lead_days,
      inactive_client_days: payload.inactive_client_days,
      auto_create_alerts: payload.auto_create_alerts,
      updated_at: new Date().toISOString(),
    })
    .eq('id', activeOrgId);

  if (error) return { error: error.message };

  revalidatePath('/configuracoes/retornos');
  return { success: true };
}
