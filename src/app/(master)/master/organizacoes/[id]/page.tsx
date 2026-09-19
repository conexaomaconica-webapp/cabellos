import React from 'react';
import Link from 'next/link';
import { fetchOrganizationDetail } from '@/lib/master/actions';
import {
  Building2,
  Users,
  ShieldCheck,
  HardDriveDownload,
  AlertTriangle,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import MasterOrgStatusActions from './MasterOrgStatusActions';

export const revalidate = 0;

export default async function MasterOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const orgId = resolvedParams.id;
  let detail: any = null;

  try {
    detail = await fetchOrganizationDetail(orgId);
  } catch (err) {
    console.error('Erro ao carregar detalhes do salão:', err);
  }

  if (!detail || !detail.organization) {
    return (
      <div className="space-y-4">
        <Link href="/master/organizacoes" className="text-xs text-purple-400 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar para Salões
        </Link>
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
          Organização não encontrada.
        </div>
      </div>
    );
  }

  const { organization: org, users, subscription, backups, auditLogs } = detail;

  return (
    <div className="space-y-6">
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <Link href="/master/organizacoes" className="text-xs text-purple-400 hover:underline flex items-center gap-1 mb-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para lista de salões
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{org.name}</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                org.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : org.status === 'suspended'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {org.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* BOTOES DE STATUS (ATIVAR / SUSPENDER / ARQUIVAR) */}
        <MasterOrgStatusActions orgId={org.id} currentStatus={org.status} />
      </div>

      {/* METRICAS DO SALÃO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Plano SaaS Ativo</span>
          <p className="text-lg font-bold text-purple-300">{subscription?.saas_plans?.name || 'Plano Legado'}</p>
          <span className="text-xs text-slate-500 dark:text-slate-400">R$ {subscription?.price_snapshot || 0}/mês</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Usuários Vinculados</span>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{users.length}</p>
          <span className="text-xs text-slate-500 dark:text-slate-400">Admins, Recepcionistas e Profissionais</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Backups de Segurança</span>
          <p className="text-lg font-bold text-emerald-400">{backups.length} exportações</p>
          <span className="text-xs text-slate-500 dark:text-slate-400">Storage Privado</span>
        </div>
      </div>

      {/* USUÁRIOS DO TENANT */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="h-5 w-5 text-purple-400" /> Usuários Vinculados ao Tenant
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-950 font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Nome / E-mail</th>
                <th className="px-4 py-3">Papel no Salão</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u: any) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {u.profiles?.full_name || 'Sem nome'} ({u.profiles?.email})
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 font-bold">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-emerald-400">
                    {u.is_active ? 'Ativo' : 'Inativo'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
