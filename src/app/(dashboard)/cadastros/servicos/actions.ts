'use server';

import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const serviceSchema = z.object({
  name: z.string().min(2, 'Informe o nome do serviço'),
  description: z.string().optional().nullable(),
  category_id: z.string().uuid().optional().nullable().or(z.literal('')),
  price: z.coerce.number().min(0, 'Informe um preço válido'),
  duration_minutes: z.coerce.number().int().min(1, 'A duração deve ser de no mínimo 1 minuto'),
  default_return_interval_days: z.coerce.number().int().min(1).default(15),
  counts_for_return_frequency: z.boolean().default(true),
});

export async function createServiceAction(formData: FormData) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const category_id = formData.get('category_id') as string;
  const price = formData.get('price') as string;
  const duration_minutes = formData.get('duration_minutes') as string;
  const default_return = formData.get('default_return_interval_days') as string;
  const counts_for_return = formData.get('counts_for_return_frequency') === 'true' || formData.get('counts_for_return_frequency') === 'on';

  const validated = serviceSchema.safeParse({
    name,
    description,
    category_id: category_id || null,
    price,
    duration_minutes,
    default_return_interval_days: default_return ? parseInt(default_return) : 15,
    counts_for_return_frequency: counts_for_return,
  });

  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  const { error } = await supabase.from('services').insert({
    organization_id: activeOrgId,
    name: validated.data.name,
    description: validated.data.description || null,
    category_id: validated.data.category_id || null,
    price: validated.data.price,
    duration_minutes: validated.data.duration_minutes,
    default_return_interval_days: validated.data.default_return_interval_days,
    counts_for_return_frequency: validated.data.counts_for_return_frequency,
    is_active: true,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: 'Já existe um serviço com este nome nesta organização' };
    }
    return { error: error.message };
  }

  revalidatePath('/cadastros/servicos');
  return redirect('/cadastros/servicos');
}

export async function updateServiceAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const category_id = formData.get('category_id') as string;
  const price = formData.get('price') as string;
  const duration_minutes = formData.get('duration_minutes') as string;
  const default_return = formData.get('default_return_interval_days') as string;
  const counts_for_return = formData.get('counts_for_return_frequency') === 'true' || formData.get('counts_for_return_frequency') === 'on';

  const validated = serviceSchema.safeParse({
    name,
    description,
    category_id: category_id || null,
    price,
    duration_minutes,
    default_return_interval_days: default_return ? parseInt(default_return) : 15,
    counts_for_return_frequency: counts_for_return,
  });

  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  const { error } = await supabase
    .from('services')
    .update({
      name: validated.data.name,
      description: validated.data.description || null,
      category_id: validated.data.category_id || null,
      price: validated.data.price,
      duration_minutes: validated.data.duration_minutes,
      default_return_interval_days: validated.data.default_return_interval_days,
      counts_for_return_frequency: validated.data.counts_for_return_frequency,
    })
    .eq('id', id)
    .eq('organization_id', activeOrgId);

  if (error) return { error: error.message };

  revalidatePath('/cadastros/servicos');
  return redirect('/cadastros/servicos');
}

export async function toggleServiceActiveAction(id: string, currentStatus: boolean) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const { error } = await supabase
    .from('services')
    .update({ is_active: !currentStatus })
    .eq('id', id)
    .eq('organization_id', activeOrgId);

  if (error) return { error: error.message };

  revalidatePath('/cadastros/servicos');
  return { success: true };
}
