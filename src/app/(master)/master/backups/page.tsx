import React from 'react';
import { fetchBackupsList } from '@/lib/master/actions';
import { HardDriveDownload, CheckCircle2, AlertTriangle, Clock, Download } from 'lucide-react';
import MasterBackupClientButton from './MasterBackupClientButton';

export const revalidate = 0;

export default async function MasterBackupsPage() {
  let backups: any[] = [];

  try {
    backups = await fetchBackupsList();
  } catch (err) {
    console.error('Erro ao carregar backups:', err);
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Exportações & Backups Lógicos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Histórico de backups de segurança privados por tenant, checksum SHA-256 e download via URL assinada.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-950 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Salão / Tenant</th>
                <th className="px-6 py-4">Solicitado Por</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Tamanho</th>
                <th className="px-6 py-4">Checksum (SHA-256)</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma exportação de segurança gerada.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                      {b.organizations?.name || 'Tenant'}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                      {b.profiles?.email || 'Master'}
                    </td>
                    <td className="px-6 py-4">
                      {b.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3.5 w-3.5" /> CONCLUÍDO
                        </span>
                      )}
                      {b.status === 'processing' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="h-3.5 w-3.5" /> PROCESSANDO
                        </span>
                      )}
                      {b.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <AlertTriangle className="h-3.5 w-3.5" /> FALHA
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-700 dark:text-slate-300">
                      {formatBytes(b.size_bytes)}
                    </td>
                    <td className="px-6 py-4 text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                      {b.checksum || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {b.status === 'completed' ? (
                        <MasterBackupClientButton backupId={b.id} />
                      ) : (
                        <span className="text-xs text-slate-500 font-normal">Indisponível</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
