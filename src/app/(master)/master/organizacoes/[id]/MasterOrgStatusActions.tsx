'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { masterSetOrganizationStatus, triggerTenantBackupAction, masterDeleteOrganization } from '@/lib/master/actions';
import { TenantStatus } from '@/types/master';
import { CheckCircle2, AlertTriangle, Archive, HardDriveDownload, Trash2 } from 'lucide-react';

export default function MasterOrgStatusActions({
  orgId,
  currentStatus,
}: {
  orgId: string;
  currentStatus: TenantStatus;
}) {
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const router = useRouter();

  const handleStatusChange = async (newStatus: TenantStatus) => {
    if (newStatus === 'archived') {
      const confirmText = prompt('Digite ARQUIVAR para confirmar o arquivamento deste salão:');
      if (confirmText !== 'ARQUIVAR') {
        alert('Arquivamento cancelado.');
        return;
      }
    }

    setLoading(true);
    try {
      await masterSetOrganizationStatus(orgId, newStatus);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Falha ao alterar status.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await triggerTenantBackupAction(orgId);
      if (res.success) {
        alert('Exportação de segurança gerada com sucesso!');
        router.refresh();
      } else {
        alert(`Erro na exportação: ${res.error}`);
      }
    } catch (err: any) {
      alert(err.message || 'Falha ao gerar backup.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmText = prompt('Esta ação irá apagar DEFINITIVAMENTE este salão e todos os dados associados a ele. Para continuar, digite APAGAR:');
    if (confirmText !== 'APAGAR') {
      alert('Exclusão cancelada.');
      return;
    }

    setLoading(true);
    try {
      const res = await masterDeleteOrganization(orgId);
      if (res.error) {
        alert(res.error);
      } else {
        router.push('/master/organizacoes');
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || 'Falha ao excluir o salão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={backupLoading}
        onClick={handleTriggerBackup}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all"
      >
        <HardDriveDownload className="h-4 w-4 text-purple-400" />
        {backupLoading ? 'Gerando Backup...' : 'Gerar Exportação'}
      </button>

      {currentStatus !== 'active' && (
        <button
          type="button"
          disabled={loading}
          onClick={() => handleStatusChange('active')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white text-xs font-medium transition-all shadow"
        >
          <CheckCircle2 className="h-4 w-4" /> Reativar Salão
        </button>
      )}

      {currentStatus === 'active' && (
        <button
          type="button"
          disabled={loading}
          onClick={() => handleStatusChange('suspended')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-900 dark:text-white text-xs font-medium transition-all shadow"
        >
          <AlertTriangle className="h-4 w-4" /> Suspender
        </button>
      )}

      {currentStatus !== 'archived' && (
        <button
          type="button"
          disabled={loading}
          onClick={() => handleStatusChange('archived')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-medium transition-all"
        >
          <Archive className="h-4 w-4" /> Arquivar
        </button>
      )}

      {currentStatus === 'archived' && (
        <button
          type="button"
          disabled={loading}
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-medium transition-all ml-auto"
        >
          <Trash2 className="h-4 w-4" /> Excluir Definitivamente
        </button>
      )}
    </div>
  );
}
