'use server';

import { createClient, setActiveOrganizationId } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const onboardingSchema = z.object({
  name: z.string().min(2, 'Informe o nome do estabelecimento'),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  primary_color: z.string().default('#0f172a'),
  secondary_color: z.string().default('#64748b'),
});

export async function createOrganizationAction(formData: FormData) {
  const name = formData.get('name') as string;
  const phone = formData.get('phone') as string;
  const whatsapp = formData.get('whatsapp') as string;
  const primary_color = (formData.get('primary_color') as string) || '#0f172a';
  const secondary_color = (formData.get('secondary_color') as string) || '#64748b';
  const logoFile = formData.get('logo') as File | null;

  const validated = onboardingSchema.safeParse({
    name,
    phone,
    whatsapp,
    primary_color,
    secondary_color,
  });

  if (!validated.success) {
    return { error: validated.error.errors[0].message };
  }

  const supabase = await createClient();

  let logoUrl: string | null = null;

  // Processar upload de logomarca se um arquivo foi enviado
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
        logoUrl = publicUrlData.publicUrl;
      } else if (uploadError) {
        console.error('Aviso ao fazer upload da logomarca no Supabase Storage:', uploadError);
      }
    } catch (storageErr) {
      console.error('Erro ao processar arquivo da logomarca:', storageErr);
    }
  }

  // Executar a RPC atômica SECURITY DEFINER de onboarding
  const { data: result, error } = await supabase.rpc(
    'create_organization_with_admin',
    {
      p_name: name,
      p_phone: phone || null,
      p_whatsapp: whatsapp || null,
      p_primary_color: primary_color,
      p_secondary_color: secondary_color,
      p_logo_url: logoUrl,
    }
  );

  if (error || !result || !result.id) {
    return { error: error?.message || 'Erro ao criar o estabelecimento' };
  }

  // Definir cookie seguro da organização ativa
  await setActiveOrganizationId(result.id);

  return redirect('/dashboard');
}
