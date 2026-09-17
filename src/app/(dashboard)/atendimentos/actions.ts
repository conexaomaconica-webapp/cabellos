'use server';

import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { normalizePhoneNumber } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export interface CompleteAppointmentPayload {
  appointment_id?: string;
  client_id: string;
  professional_id?: string | null;
  notes?: string | null;
  services: {
    service_id: string;
    professional_id?: string | null;
    quantity?: number;
    discount?: number;
  }[];
  payments?: {
    payment_method_id: string;
    amount: number;
    installments?: number;
    notes?: string | null;
  }[];
}

export async function completeAppointmentAction(payload: CompleteAppointmentPayload) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    return { error: 'Organização não selecionada' };
  }

  // Chamar a RPC atômica transacional no PostgreSQL
  const { data: result, error } = await supabase.rpc('complete_appointment', {
    p_data: {
      ...payload,
      organization_id: activeOrgId,
    },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/atendimentos');
  revalidatePath('/dashboard');
  revalidatePath(`/clientes/${payload.client_id}`);

  return redirect('/atendimentos');
}

export async function cancelAppointmentAction(appointmentId: string, reason?: string) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const { error } = await supabase.rpc('cancel_appointment', {
    p_appointment_id: appointmentId,
    p_reason: reason || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/atendimentos');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function quickCreateClientAction(name: string, whatsapp: string) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };
  if (!name || name.trim().length < 2) return { error: 'Informe o nome do cliente' };

  const normWhatsapp = whatsapp ? normalizePhoneNumber(whatsapp) : null;

  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      organization_id: activeOrgId,
      name: name.trim(),
      whatsapp: normWhatsapp,
      allow_whatsapp: true,
      is_active: true,
    })
    .select()
    .single();

  if (error || !newClient) {
    return { error: error?.message || 'Erro ao cadastrar cliente' };
  }

  revalidatePath('/clientes');
  return { success: true, client: newClient };
}
