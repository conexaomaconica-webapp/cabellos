'use server';

import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { normalizePhoneNumber } from '@/lib/utils';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const clientSchema = z.object({
  name: z.string().min(2, 'Informe o nome do cliente'),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  birth_date: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  preferred_professional_id: z.string().uuid().optional().nullable().or(z.literal('')),
  preferred_service_id: z.string().uuid().optional().nullable().or(z.literal('')),
  custom_return_interval_days: z.coerce.number().int().positive().optional().nullable(),
  allow_whatsapp: z.boolean().default(true),
});

export async function createClientAction(formData: FormData) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    return { error: 'Organização não selecionada' };
  }

  const name = formData.get('name') as string;
  const rawPhone = formData.get('phone') as string;
  const rawWhatsapp = formData.get('whatsapp') as string;
  const email = formData.get('email') as string;
  const birth_date = formData.get('birth_date') as string;
  const gender = formData.get('gender') as string;
  const notes = formData.get('notes') as string;
  const preferred_professional_id = formData.get('preferred_professional_id') as string;
  const preferred_service_id = formData.get('preferred_service_id') as string;
  const custom_return = formData.get('custom_return_interval_days') as string;
  const allow_whatsapp = formData.get('allow_whatsapp') === 'true' || formData.get('allow_whatsapp') === 'on';

  const phone = rawPhone ? normalizePhoneNumber(rawPhone) : null;
  const whatsapp = rawWhatsapp ? normalizePhoneNumber(rawWhatsapp) : null;

  const validated = clientSchema.safeParse({
    name,
    phone,
    whatsapp,
    email,
    birth_date: birth_date || null,
    gender: gender || null,
    notes: notes || null,
    preferred_professional_id: preferred_professional_id || null,
    preferred_service_id: preferred_service_id || null,
    custom_return_interval_days: custom_return ? parseInt(custom_return) : null,
    allow_whatsapp,
  });

  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  const { error } = await supabase.from('clients').insert({
    organization_id: activeOrgId,
    name: validated.data.name,
    phone: validated.data.phone,
    whatsapp: validated.data.whatsapp,
    email: validated.data.email || null,
    birth_date: validated.data.birth_date || null,
    gender: validated.data.gender || null,
    notes: validated.data.notes || null,
    preferred_professional_id: validated.data.preferred_professional_id || null,
    preferred_service_id: validated.data.preferred_service_id || null,
    custom_return_interval_days: validated.data.custom_return_interval_days || null,
    allow_whatsapp: validated.data.allow_whatsapp,
    is_active: true,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/clientes');
  return redirect('/clientes');
}

export async function updateClientAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    return { error: 'Organização não selecionada' };
  }

  const name = formData.get('name') as string;
  const rawPhone = formData.get('phone') as string;
  const rawWhatsapp = formData.get('whatsapp') as string;
  const email = formData.get('email') as string;
  const birth_date = formData.get('birth_date') as string;
  const gender = formData.get('gender') as string;
  const notes = formData.get('notes') as string;
  const preferred_professional_id = formData.get('preferred_professional_id') as string;
  const preferred_service_id = formData.get('preferred_service_id') as string;
  const custom_return = formData.get('custom_return_interval_days') as string;
  const allow_whatsapp = formData.get('allow_whatsapp') === 'true' || formData.get('allow_whatsapp') === 'on';

  const phone = rawPhone ? normalizePhoneNumber(rawPhone) : null;
  const whatsapp = rawWhatsapp ? normalizePhoneNumber(rawWhatsapp) : null;

  const validated = clientSchema.safeParse({
    name,
    phone,
    whatsapp,
    email,
    birth_date: birth_date || null,
    gender: gender || null,
    notes: notes || null,
    preferred_professional_id: preferred_professional_id || null,
    preferred_service_id: preferred_service_id || null,
    custom_return_interval_days: custom_return ? parseInt(custom_return) : null,
    allow_whatsapp,
  });

  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  const { error } = await supabase
    .from('clients')
    .update({
      name: validated.data.name,
      phone: validated.data.phone,
      whatsapp: validated.data.whatsapp,
      email: validated.data.email || null,
      birth_date: validated.data.birth_date || null,
      gender: validated.data.gender || null,
      notes: validated.data.notes || null,
      preferred_professional_id: validated.data.preferred_professional_id || null,
      preferred_service_id: validated.data.preferred_service_id || null,
      custom_return_interval_days: validated.data.custom_return_interval_days || null,
      allow_whatsapp: validated.data.allow_whatsapp,
    })
    .eq('id', id)
    .eq('organization_id', activeOrgId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/clientes');
  return redirect('/clientes');
}

export async function inactivateClientAction(id: string) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  // Inativação lógica (sem delete físico no MVP)
  const { error } = await supabase
    .from('clients')
    .update({ is_active: false })
    .eq('id', id)
    .eq('organization_id', activeOrgId);

  if (error) return { error: error.message };

  revalidatePath('/clientes');
  return { success: true };
}

export async function checkDuplicateClientAction(phone: string, whatsapp: string) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { duplicates: [] };

  const normPhone = normalizePhoneNumber(phone);
  const normWhatsapp = normalizePhoneNumber(whatsapp);

  if (!normPhone && !normWhatsapp) return { duplicates: [] };

  const queries = [];
  if (normPhone) queries.push(`phone.eq.${normPhone}`);
  if (normWhatsapp) queries.push(`whatsapp.eq.${normWhatsapp}`);

  const { data } = await supabase
    .from('clients')
    .select('id, name, phone, whatsapp')
    .eq('organization_id', activeOrgId)
    .or(queries.join(','));

  return { duplicates: data || [] };
}
