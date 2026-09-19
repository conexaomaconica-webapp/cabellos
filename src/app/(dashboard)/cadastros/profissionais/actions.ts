'use server';

import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const professionalSchema = z.object({
  name: z.string().min(2, 'Informe o nome do profissional'),
  phone: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  commission_type: z.enum(['none', 'percentage', 'fixed', 'custom']).default('none'),
  commission_value: z.coerce.number().min(0, 'Valor de comissão inválido').default(0),
});

export async function createProfessionalAction(formData: FormData, selectedServiceIds: string[]) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const name = formData.get('name') as string;
  const phone = formData.get('phone') as string;
  const email = formData.get('email') as string;
  const commission_type = formData.get('commission_type') as 'none' | 'percentage' | 'fixed' | 'custom';
  const commission_value = formData.get('commission_value') as string;
  let photo_url = (formData.get('photo_url') as string) || null;
  const photoFile = formData.get('photo_file') as File | null;

  const validated = professionalSchema.safeParse({
    name,
    phone,
    email,
    commission_type,
    commission_value,
  });

  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  // Se um arquivo de imagem foi enviado, fazer upload no Supabase Storage
  if (photoFile && photoFile.size > 0 && photoFile.name) {
    try {
      const ext = photoFile.name.split('.').pop() || 'png';
      const filePath = `professionals/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const buffer = Buffer.from(await photoFile.arrayBuffer());

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, buffer, {
          contentType: photoFile.type || 'image/png',
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from('logos')
          .getPublicUrl(filePath);
        photo_url = publicUrlData.publicUrl;
      }
    } catch (storageErr) {
      console.error('Erro ao fazer upload da foto do profissional:', storageErr);
    }
  }

  // Insere o profissional garantindo o organization_id
  const { data: prof, error } = await supabase
    .from('professionals')
    .insert({
      organization_id: activeOrgId,
      name: validated.data.name,
      phone: validated.data.phone || null,
      email: validated.data.email || null,
      photo_url: photo_url,
      commission_type: validated.data.commission_type,
      commission_value: validated.data.commission_value,
      is_active: true,
    })
    .select()
    .single();

  if (error || !prof) return { error: error?.message || 'Erro ao cadastrar profissional' };

  // Vincula os serviços prestados garantindo o organization_id em professional_services
  if (selectedServiceIds.length > 0) {
    const profServices = selectedServiceIds.map((serviceId) => ({
      organization_id: activeOrgId,
      professional_id: prof.id,
      service_id: serviceId,
      is_active: true,
    }));

    await supabase.from('professional_services').insert(profServices);
  }

  revalidatePath('/cadastros/profissionais');
  return redirect('/cadastros/profissionais');
}

export async function updateProfessionalAction(id: string, formData: FormData, selectedServiceIds: string[]) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const name = formData.get('name') as string;
  const phone = formData.get('phone') as string;
  const email = formData.get('email') as string;
  const commission_type = formData.get('commission_type') as 'none' | 'percentage' | 'fixed' | 'custom';
  const commission_value = formData.get('commission_value') as string;
  let photo_url = (formData.get('photo_url') as string) || null;
  const photoFile = formData.get('photo_file') as File | null;

  const validated = professionalSchema.safeParse({
    name,
    phone,
    email,
    commission_type,
    commission_value,
  });

  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  // Se um arquivo de imagem foi enviado, fazer upload no Supabase Storage
  if (photoFile && photoFile.size > 0 && photoFile.name) {
    try {
      const ext = photoFile.name.split('.').pop() || 'png';
      const filePath = `professionals/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const buffer = Buffer.from(await photoFile.arrayBuffer());

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, buffer, {
          contentType: photoFile.type || 'image/png',
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from('logos')
          .getPublicUrl(filePath);
        photo_url = publicUrlData.publicUrl;
      }
    } catch (storageErr) {
      console.error('Erro ao fazer upload da foto do profissional:', storageErr);
    }
  }

  const { error } = await supabase
    .from('professionals')
    .update({
      name: validated.data.name,
      phone: validated.data.phone || null,
      email: validated.data.email || null,
      photo_url: photo_url,
      commission_type: validated.data.commission_type,
      commission_value: validated.data.commission_value,
    })
    .eq('id', id)
    .eq('organization_id', activeOrgId);

  if (error) return { error: error.message };

  // Atualizar vínculo de serviços
  await supabase
    .from('professional_services')
    .delete()
    .eq('professional_id', id)
    .eq('organization_id', activeOrgId);

  if (selectedServiceIds.length > 0) {
    const profServices = selectedServiceIds.map((serviceId) => ({
      organization_id: activeOrgId,
      professional_id: id,
      service_id: serviceId,
      is_active: true,
    }));

    await supabase.from('professional_services').insert(profServices);
  }

  revalidatePath('/cadastros/profissionais');
  return redirect('/cadastros/profissionais');
}

export async function toggleProfessionalActiveAction(id: string, currentStatus: boolean) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const { error } = await supabase
    .from('professionals')
    .update({ is_active: !currentStatus })
    .eq('id', id)
    .eq('organization_id', activeOrgId);

  if (error) return { error: error.message };

  revalidatePath('/cadastros/profissionais');
  return { success: true };
}
