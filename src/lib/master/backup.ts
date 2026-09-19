import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export interface BackupGenerationResult {
  success: boolean;
  backupId?: string;
  sizeBytes?: number;
  checksum?: string;
  storagePath?: string;
  error?: string;
}

/**
 * Processamento Server-Side de Exportação Lógica Privada do Tenant.
 * Coleta exclusivamente dados de domínio do salão e gera payload sanitizado.
 */
export async function processTenantBackupExport(
  supabase: SupabaseClient,
  masterUserId: string,
  organizationId: string
): Promise<BackupGenerationResult> {
  // 1. Criar registro pendente em tenant_backups
  const { data: backupRecord, error: initError } = await supabase
    .from('tenant_backups')
    .insert({
      organization_id: organizationId,
      requested_by: masterUserId,
      type: 'manual_export',
      status: 'pending',
      checksum_algorithm: 'SHA-256',
    })
    .select()
    .single();

  if (initError || !backupRecord) {
    return { success: false, error: initError?.message || 'Falha ao inicializar o registro de backup.' };
  }

  const backupId = backupRecord.id;

  try {
    // 2. Atualizar status para processing
    await supabase
      .from('tenant_backups')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', backupId);

    // 3. Coletar dados da organização
    const { data: orgData } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (!orgData) {
      throw new Error('Organização não encontrada para exportação.');
    }

    // 4. Coletar tabelas operacionais de domínio
    const [
      { data: orgUsers },
      { data: clients },
      { data: professionals },
      { data: services },
      { data: serviceCategories },
      { data: appointments },
      { data: packages },
      { data: clientPackages },
      { data: financialCategories },
      { data: cashRegisters },
      { data: financialTransactions },
      { data: accountsReceivable },
      { data: accountsPayable },
      { data: commissions },
    ] = await Promise.all([
      supabase.from('organization_users').select('organization_id, user_id, role, is_active, created_at').eq('organization_id', organizationId),
      supabase.from('clients').select('id, name, phone, email, is_active, notes, created_at').eq('organization_id', organizationId),
      supabase.from('professionals').select('id, name, phone, email, is_active, commission_rate, created_at').eq('organization_id', organizationId),
      supabase.from('services').select('id, name, description, duration_minutes, price, is_active, created_at').eq('organization_id', organizationId),
      supabase.from('service_categories').select('id, name, is_active, created_at').eq('organization_id', organizationId),
      supabase.from('appointments').select('id, client_id, status, start_time, end_time, total_amount, notes, created_at').eq('organization_id', organizationId),
      supabase.from('packages').select('id, name, price, total_credits, is_active, created_at').eq('organization_id', organizationId),
      supabase.from('client_packages').select('id, client_id, package_id, status, created_at').eq('organization_id', organizationId),
      supabase.from('financial_categories').select('id, name, type, is_active, created_at').eq('organization_id', organizationId),
      supabase.from('cash_registers').select('id, name, is_open, opening_balance, current_balance, created_at').eq('organization_id', organizationId),
      supabase.from('financial_transactions').select('id, description, amount, type, status, payment_method, due_date, paid_at, created_at').eq('organization_id', organizationId),
      supabase.from('accounts_receivable').select('id, amount, due_date, status, created_at').eq('organization_id', organizationId),
      supabase.from('accounts_payable').select('id, amount, due_date, status, created_at').eq('organization_id', organizationId),
      supabase.from('commissions').select('id, professional_id, amount, status, period_start, period_end, created_at').eq('organization_id', organizationId),
    ]);

    // 5. Construir manifesto e exportação lógica sanitizada
    const exportManifest = {
      manifest: {
        tenant_id: organizationId,
        organization_name: orgData.name,
        generated_at: new Date().toISOString(),
        schema_version: '1.0',
        application_version: '1.0',
        checksum_algorithm: 'SHA-256',
        exported_by: masterUserId,
      },
      domain_data: {
        organization: orgData,
        organization_users: orgUsers || [],
        clients: clients || [],
        professionals: professionals || [],
        services: services || [],
        service_categories: serviceCategories || [],
        appointments: appointments || [],
        packages: packages || [],
        client_packages: clientPackages || [],
        financial_categories: financialCategories || [],
        cash_registers: cashRegisters || [],
        financial_transactions: financialTransactions || [],
        accounts_receivable: accountsReceivable || [],
        accounts_payable: accountsPayable || [],
        commissions: commissions || [],
      },
    };

    const jsonString = JSON.stringify(exportManifest, null, 2);
    const buffer = Buffer.from(jsonString, 'utf-8');
    const sizeBytes = buffer.length;

    // 6. Calcular Checksum SHA-256
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // 7. Salvar no Storage privado Supabase
    const storagePath = `backups/${organizationId}/${backupId}.json`;
    const { error: uploadError } = await supabase.storage
      .from('tenant-backups')
      .upload(storagePath, buffer, {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Falha no upload para o Storage: ${uploadError.message}`);
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias

    // 8. Atualizar registro com sucesso
    await supabase
      .from('tenant_backups')
      .update({
        status: 'completed',
        storage_path: storagePath,
        size_bytes: sizeBytes,
        checksum: checksum,
        completed_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq('id', backupId);

    // 9. Registrar Auditoria Master
    await supabase.from('master_audit_logs').insert({
      master_user_id: masterUserId,
      action: 'backup_generated',
      entity_type: 'tenant_backup',
      entity_id: backupId,
      organization_id: organizationId,
      after_data: {
        backup_id: backupId,
        size_bytes: sizeBytes,
        checksum: checksum,
        storage_path: storagePath,
      },
    });

    return {
      success: true,
      backupId,
      sizeBytes,
      checksum,
      storagePath,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido durante o backup.';

    // Registrar erro no banco sem deixar inconsistente
    await supabase
      .from('tenant_backups')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', backupId);

    return { success: false, backupId, error: errorMessage };
  }
}

/**
 * Gera URL assinada com curta duração para download do backup pelo Master e registra auditoria.
 */
export async function getTenantBackupSignedUrl(
  supabase: SupabaseClient,
  masterUserId: string,
  backupId: string
) {
  const { data: backup, error: fetchErr } = await supabase
    .from('tenant_backups')
    .select('*')
    .eq('id', backupId)
    .single();

  if (fetchErr || !backup || !backup.storage_path) {
    throw new Error('Registro de backup não encontrado ou sem arquivo gerado.');
  }

  if (backup.status !== 'completed') {
    throw new Error(`O backup possui status '${backup.status}' e não pode ser baixado.`);
  }

  // Gerar Signed URL com validade de 60 segundos
  const { data: signedData, error: signErr } = await supabase.storage
    .from('tenant-backups')
    .createSignedUrl(backup.storage_path, 60);

  if (signErr || !signedData?.signedUrl) {
    throw new Error(`Falha ao gerar URL assinada: ${signErr?.message}`);
  }

  // Registrar Auditoria do Download
  await supabase.from('master_audit_logs').insert({
    master_user_id: masterUserId,
    action: 'backup_downloaded',
    entity_type: 'tenant_backup',
    entity_id: backupId,
    organization_id: backup.organization_id,
    metadata: {
      size_bytes: backup.size_bytes,
      checksum: backup.checksum,
    },
  });

  return signedData.signedUrl;
}

/**
 * Expira um backup removendo o arquivo do Storage primeiro e depois marcando status = 'expired'.
 */
export async function expireTenantBackup(
  supabase: SupabaseClient,
  masterUserId: string,
  backupId: string
) {
  const { data: backup } = await supabase
    .from('tenant_backups')
    .select('*')
    .eq('id', backupId)
    .single();

  if (!backup) return false;

  if (backup.storage_path) {
    const { error: removeErr } = await supabase.storage
      .from('tenant-backups')
      .remove([backup.storage_path]);

    if (removeErr) {
      await supabase
        .from('tenant_backups')
        .update({ error_message: `Falha ao remover arquivo do storage: ${removeErr.message}` })
        .eq('id', backupId);
      return false;
    }
  }

  await supabase
    .from('tenant_backups')
    .update({ status: 'expired', storage_path: null })
    .eq('id', backupId);

  await supabase.from('master_audit_logs').insert({
    master_user_id: masterUserId,
    action: 'backup_expired',
    entity_type: 'tenant_backup',
    entity_id: backupId,
    organization_id: backup.organization_id,
  });

  return true;
}
