'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { AssetType, SystemAsset, SystemBranding } from '@/types/system-assets';
import crypto from 'crypto';

async function getMasterClient() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignorar em Server Components
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Não autenticado.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single();

  if (profile?.system_role !== 'master') {
    throw new Error('Acesso negado: Somente Master.');
  }

  return { supabase, user };
}

export async function uploadSystemAssetAction(formData: FormData) {
  const { supabase, user } = await getMasterClient();
  const file = formData.get('file') as File;
  const assetType = formData.get('asset_type') as AssetType;

  if (!file || !assetType) {
    throw new Error('Arquivo e tipo de ativo são obrigatórios.');
  }

  // Validação de Tamanhos Máximos
  const isSplash = assetType === 'splash_video' || assetType === 'splash_image';
  const maxSize = isSplash ? 10 * 1024 * 1024 : 2 * 1024 * 1024; // 10MB splash, 2MB logo

  if (file.size > maxSize) {
    throw new Error(`Arquivo excede o limite máximo permitido (${isSplash ? '10MB' : '2MB'}).`);
  }

  // Validação de MIME Type
  const allowedMimeTypes: Record<string, string[]> = {
    logo_primary: ['image/svg+xml', 'image/png', 'image/webp'],
    logo_compact: ['image/svg+xml', 'image/png', 'image/webp'],
    favicon: ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml'],
    splash_video: ['video/mp4', 'video/webm'],
    splash_image: ['image/png', 'image/webp', 'image/jpeg'],
  };

  const allowed = allowedMimeTypes[assetType] || [];
  if (!allowed.includes(file.type)) {
    throw new Error(`Tipo de arquivo não suportado (${file.type}) para ${assetType}.`);
  }

  const ext = file.name.split('.').pop() || 'bin';
  const folder = isSplash ? 'splash' : assetType === 'favicon' ? 'favicon' : 'logos';
  const internalFileName = `${crypto.randomUUID()}.${ext}`;
  const storagePath = `${folder}/${internalFileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload para o bucket público system-assets
  const { error: uploadError } = await supabase.storage
    .from('system-assets')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Falha no upload do ativo: ${uploadError.message}`);
  }

  // Inserir registro na tabela system_assets
  const { data: asset, error: dbError } = await supabase
    .from('system_assets')
    .insert({
      asset_type: assetType,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      created_by: user.id,
      is_active: false,
    })
    .select()
    .single();

  if (dbError || !asset) {
    throw new Error(`Falha ao registrar ativo: ${dbError?.message}`);
  }

  // Registrar Auditoria Master
  await supabase.from('master_audit_logs').insert({
    master_user_id: user.id,
    action: isSplash ? 'splash_uploaded' : 'system_logo_uploaded',
    entity_type: 'system_asset',
    entity_id: asset.id,
    after_data: { asset_type: assetType, storage_path: storagePath, file_name: file.name },
  });

  return asset;
}

export async function activateSystemAssetAction(assetId: string) {
  const { supabase } = await getMasterClient();
  const { data, error } = await supabase.rpc('master_activate_system_asset', {
    p_asset_id: assetId,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function deactivateSplashAction() {
  const { supabase } = await getMasterClient();
  const { data, error } = await supabase.rpc('master_deactivate_splash');
  if (error) throw new Error(error.message);
  return data;
}

export async function archiveSystemAssetAction(assetId: string) {
  const { supabase, user } = await getMasterClient();
  
  const { data: asset } = await supabase.from('system_assets').select('*').eq('id', assetId).single();
  if (!asset) throw new Error('Ativo não encontrado.');

  if (asset.is_active) {
    throw new Error('Não é possível arquivar um ativo atualmente ativo. Ative outro substituto primeiro.');
  }

  const { data, error } = await supabase
    .from('system_assets')
    .update({
      archived_at: new Date().toISOString(),
      archived_by: user.id,
    })
    .eq('id', assetId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from('master_audit_logs').insert({
    master_user_id: user.id,
    action: asset.asset_type.startsWith('splash') ? 'splash_archived' : 'system_logo_archived',
    entity_type: 'system_asset',
    entity_id: assetId,
  });

  return data;
}

export async function fetchSystemAssetsAction(): Promise<SystemAsset[]> {
  const { supabase } = await getMasterClient();
  const { data, error } = await supabase
    .from('system_assets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const assetsWithUrls = (data || []).map((asset) => {
    const { data: urlData } = supabase.storage.from('system-assets').getPublicUrl(asset.storage_path);
    return {
      ...asset,
      public_url: urlData.publicUrl,
    };
  });

  return assetsWithUrls;
}

export async function getSystemBrandingAction(): Promise<SystemBranding> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Ignorar
        },
      },
    }
  );

  const { data } = await supabase.rpc('get_system_branding');

  if (!data) {
    return { logo_primary: null, logo_compact: null, favicon: null, splash: null };
  }

  const resolveUrl = (item: any) => {
    if (!item?.storage_path) return null;
    const { data: urlData } = supabase.storage.from('system-assets').getPublicUrl(item.storage_path);
    return {
      ...item,
      public_url: urlData.publicUrl,
    };
  };

  return {
    logo_primary: resolveUrl(data.logo_primary),
    logo_compact: resolveUrl(data.logo_compact),
    favicon: resolveUrl(data.favicon),
    splash: resolveUrl(data.splash),
  };
}
