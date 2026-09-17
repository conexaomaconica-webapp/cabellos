'use server';

import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getReturnAlertsAction(tab: string = 'hoje') {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    return { data: [], error: 'Organização não selecionada' };
  }

  // 1. Atualizar status dos alertas de forma idempotente
  await supabase.rpc('update_return_alert_statuses', { p_org_id: activeOrgId });

  // 2. Data de hoje em YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  let query = supabase
    .from('return_alerts')
    .select(`
      *,
      client:clients (*),
      service:services (*),
      frequency:client_service_frequencies (
        *,
        last_professional:professionals (*)
      )
    `)
    .eq('organization_id', activeOrgId);

  switch (tab) {
    case 'hoje':
      query = query.in('status', ['due', 'upcoming']).eq('expected_return_at', todayStr);
      break;
    case 'atrasados':
      query = query.eq('status', 'overdue');
      break;
    case 'proximos_7':
      const d7 = new Date();
      d7.setDate(d7.getDate() + 7);
      const d7Str = d7.toISOString().split('T')[0];
      query = query.in('status', ['upcoming', 'due']).gte('expected_return_at', todayStr).lte('expected_return_at', d7Str);
      break;
    case 'proximos_15':
      const d15 = new Date();
      d15.setDate(d15.getDate() + 15);
      const d15Str = d15.toISOString().split('T')[0];
      query = query.in('status', ['upcoming', 'due']).gte('expected_return_at', todayStr).lte('expected_return_at', d15Str);
      break;
    case 'contatados':
      query = query.eq('status', 'contacted');
      break;
    case 'adiados':
      query = query.eq('status', 'snoozed');
      break;
    case 'concluidos':
      query = query.in('status', ['returned', 'ignored']);
      break;
    default:
      query = query.eq('status', 'due');
      break;
  }

  const { data, error } = await query.order('expected_return_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar alertas:', error);
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

export async function updateAlertStatusAction(
  alertId: string,
  status: 'snoozed' | 'ignored' | 'contacted' | 'returned',
  snoozedUntil?: string | null,
  snoozeReason?: string | null
) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'snoozed') {
    updateData.snoozed_until = snoozedUntil;
    updateData.snooze_reason = snoozeReason || null;
  } else if (status === 'ignored' || status === 'returned') {
    updateData.resolved_at = new Date().toISOString();
    updateData.resolution = status === 'ignored' ? 'Ignorado manualmente' : 'Cliente retornou';
  }

  const { error } = await supabase
    .from('return_alerts')
    .update(updateData)
    .eq('id', alertId)
    .eq('organization_id', activeOrgId);

  if (error) return { error: error.message };

  revalidatePath('/retornos');
  return { success: true };
}

export interface RecordContactPayload {
  client_id: string;
  service_id?: string | null;
  return_alert_id?: string | null;
  contact_type: 'whatsapp' | 'phone' | 'instagram' | 'in_person' | 'other';
  message_template_id?: string | null;
  message_content: string;
  result: 'sent' | 'no_response' | 'interested' | 'scheduled' | 'declined' | 'returned';
  notes?: string | null;
}

export async function recordClientContactAction(payload: RecordContactPayload) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Usuário não autenticado' };

  // 1. Inserir registro de contato
  const { error: contactErr } = await supabase.from('client_contacts').insert({
    organization_id: activeOrgId,
    client_id: payload.client_id,
    service_id: payload.service_id || null,
    return_alert_id: payload.return_alert_id || null,
    user_id: user.id,
    contact_type: payload.contact_type,
    message_template_id: payload.message_template_id || null,
    message_content: payload.message_content,
    contacted_at: new Date().toISOString(),
    result: payload.result,
    notes: payload.notes || null,
  });

  if (contactErr) return { error: contactErr.message };

  // 2. Se houver alerta de retorno associado, atualizar para contacted
  if (payload.return_alert_id) {
    await supabase
      .from('return_alerts')
      .update({
        status: 'contacted',
        contacted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.return_alert_id)
      .eq('organization_id', activeOrgId);
  }

  // 3. Atualizar last_contact_at no cliente
  await supabase
    .from('clients')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('id', payload.client_id)
    .eq('organization_id', activeOrgId);

  revalidatePath('/retornos');
  revalidatePath(`/clientes/${payload.client_id}`);
  return { success: true };
}

export async function getInactiveClientsAction() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { data: [], error: 'Organização não selecionada' };

  // Obter dias de inatividade configurados na organização
  const { data: org } = await supabase
    .from('organizations')
    .select('inactive_client_days')
    .eq('id', activeOrgId)
    .single();

  const inactiveDays = org?.inactive_client_days || 60;
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - inactiveDays);
  const thresholdStr = thresholdDate.toISOString();

  // Buscar clientes com last_appointment_at <= thresholdStr ou nulo
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', activeOrgId)
    .eq('is_active', true)
    .or(`last_appointment_at.lte.${thresholdStr},last_appointment_at.is.null`)
    .order('last_appointment_at', { ascending: true, nullsFirst: true });

  if (error) return { data: [], error: error.message };

  return { data: data || [], error: null };
}
