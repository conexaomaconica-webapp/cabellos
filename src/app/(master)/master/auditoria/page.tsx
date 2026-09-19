import React from 'react';
import { fetchMasterAuditLogs } from '@/lib/master/actions';
import { ShieldCheck, UserCheck, Clock } from 'lucide-react';

export const revalidate = 0;

export default async function MasterAuditPage() {
  let logs: any[] = [];

  try {
    logs = await fetchMasterAuditLogs();
  } catch (err) {
    console.error('Erro ao carregar logs de auditoria:', err);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Trilha de Auditoria Master</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Registro imutável (INSERT-only) de todas as ações administrativas executadas pelos Masters da plataforma.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-950 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Data / Hora</th>
                <th className="px-6 py-4">Master</th>
                <th className="px-6 py-4">Ação</th>
                <th className="px-6 py-4">Entidade</th>
                <th className="px-6 py-4">Tenant Alvo</th>
                <th className="px-6 py-4">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Nenhum evento registrado na auditoria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                      {log.profiles?.full_name || log.profiles?.email || 'Master'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-950/60 text-purple-300 border border-purple-800/40 font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-700 dark:text-slate-300 capitalize">
                      {log.entity_type}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-700 dark:text-slate-300">
                      {log.organizations?.name || 'Global'}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                      {log.after_data ? JSON.stringify(log.after_data) : 'N/A'}
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
