'use server';

import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const orgSchema = z.object({
  name: z.string().min(2, 'O nome deve ter no mínimo 2 caracteres'),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  primary_color: z.string().min(4),
  secondary_color: z.string().min(4),
});

export async function updateOrganizationAction(formData: FormData) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    return { error: 'Organização não encontrada.' };
  }

  // Verificar permissão
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return { error: 'Não autenticado.' };

  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('role')
    .eq('organization_id', activeOrgId)
    .single();

  const { data: profile } = await supabase.from('profiles').select('system_role').eq('id', user.id).single();

  if (orgUser?.role !== 'admin' && profile?.system_role !== 'master') {
    return { error: 'Sem permissão.' };
  }

  const name = formData.get('name') as string;
  const phone = formData.get('phone') as string;
  const whatsapp = formData.get('whatsapp') as string;
  const email = formData.get('email') as string;
  const primary_color = formData.get('primary_color') as string;
  const secondary_color = formData.get('secondary_color') as string;
  const logoFile = formData.get('logo') as File | null;

  const validated = orgSchema.safeParse({ name, phone, whatsapp, email, primary_color, secondary_color });
  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  let newLogoUrl: string | null = null;

  if (logoFile && logoFile.size > 0 && logoFile.name) {
    try {
      const ext = logoFile.name.split('.').pop() || 'png';
      const cleanFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const filePath = `org-logos/${cleanFileName}`;
      const buffer = Buffer.from(await logoFile.arrayBuffer());

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, buffer, {
          contentType: logoFile.type || 'image/png',
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from('logos')
          .getPublicUrl(filePath);
        newLogoUrl = publicUrlData.publicUrl;
      } else if (uploadError) {
        console.error('Upload Error:', uploadError);
        return { error: 'Erro ao fazer upload da logomarca.' };
      }
    } catch (storageErr) {
      console.error(storageErr);
      return { error: 'Erro interno ao processar a logomarca.' };
    }
  }

  const updatePayload: any = {
    name,
    phone: phone || null,
    whatsapp: whatsapp || null,
    email: email || null,
    primary_color,
    secondary_color,
    updated_at: new Date().toISOString()
  };

  if (newLogoUrl) {
    updatePayload.logo_url = newLogoUrl;
  }

  const { error: updateError } = await supabase
    .from('organizations')
    .update(updatePayload)
    .eq('id', activeOrgId);

  if (updateError) {
    return { error: 'Erro ao atualizar dados do salão.' };
  }

  revalidatePath('/', 'layout');
  
  return { success: 'Configurações atualizadas com sucesso!', logoUrl: newLogoUrl };
}
