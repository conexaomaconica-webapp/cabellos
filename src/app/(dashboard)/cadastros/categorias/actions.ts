'use server';

import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const categorySchema = z.object({
  name: z.string().min(2, 'Informe o nome da categoria'),
  description: z.string().optional().nullable(),
  color: z.string().default('#3b82f6'),
});

export async function createCategoryAction(formData: FormData) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const color = (formData.get('color') as string) || '#3b82f6';

  const validated = categorySchema.safeParse({ name, description, color });
  if (!validated.success) return { error: validated.error.errors[0].message };

  const { error } = await supabase.from('service_categories').insert({
    organization_id: activeOrgId,
    name: validated.data.name,
    description: validated.data.description || null,
    color: validated.data.color,
    is_active: true,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: 'Já existe uma categoria com este nome nesta organização' };
    }
    return { error: error.message };
  }

  revalidatePath('/cadastros/categorias');
  return { success: true };
}

export async function updateCategoryAction(id: string, formData: FormData) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const color = (formData.get('color') as string) || '#3b82f6';

  const validated = categorySchema.safeParse({ name, description, color });
  if (!validated.success) return { error: validated.error.errors[0].message };

  const { error } = await supabase
    .from('service_categories')
    .update({
      name: validated.data.name,
      description: validated.data.description || null,
      color: validated.data.color,
    })
    .eq('id', id)
    .eq('organization_id', activeOrgId);

  if (error) return { error: error.message };

  revalidatePath('/cadastros/categorias');
  return { success: true };
}
