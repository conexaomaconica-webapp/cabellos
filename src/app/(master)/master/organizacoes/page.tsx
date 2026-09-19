import React from 'react';
import Link from 'next/link';
import { fetchOrganizations, fetchSaasPlans, fetchUsersGlobal } from '@/lib/master/actions';
import { Building2, PlusCircle, ShieldAlert, CheckCircle2, AlertTriangle, Archive, ArrowUpRight } from 'lucide-react';
import MasterOrgClientModal from './MasterOrgClientModal';

export const revalidate = 0;

export default async function MasterOrganizationsPage() {
  let orgs: any[] = [];
  let plans: any[] = [];
  let users: any[] = [];

  try {
    orgs = await fetchOrganizations();
    plans = await fetchSaasPlans();
    users = await fetchUsersGlobal();
  } catch (err) {
    console.error('Erro ao carregar salões:', err);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Salões & Tenants</h1>
          <p className="text-sm text-slate-400">
            Gerenciamento global de estabelecimentos, status de operação e assinaturas associadas.
          </p>
        </div>

        <MasterOrgClientModal plans={plans} users={users} />
      </div>

      {/* TABELA DE SALÕES */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Salão / Tenant</th>
                <th className="px-6 py-4">Localização</th>
                <th className="px-6 py-4">Status Salão</th>
                <th className="px-6 py-4">Plano SaaS</th>
                <th className="px-6 py-4">Criação</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {orgs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Nenhum salão cadastrado no sistema.
                  </td>
                </tr>
              ) : (
                orgs.map((org) => {
                  const sub = org.organization_subscriptions?.[0];
                  const plan = sub?.saas_plans;

                  return (
                    <tr key={org.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-white">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-950/60 border border-purple-800/40 rounded-lg text-purple-400">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-white font-bold">{org.name}</p>
                            <span className="text-xs text-slate-400 font-normal">ID: {org.id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {org.city && org.state ? `${org.city} - ${org.state}` : 'Não informado'}
                      </td>
                      <td className="px-6 py-4">
                        {org.status === 'active' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Ativo
                          </span>
                        )}
                        {org.status === 'suspended' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertTriangle className="h-3.5 w-3.5" /> Suspenso
                          </span>
                        )}
                        {org.status === 'archived' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            <Archive className="h-3.5 w-3.5" /> Arquivado
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-purple-300 bg-purple-950/40 border border-purple-800/40 px-2.5 py-1 rounded-lg">
                          {plan?.name || 'Plano Legado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {new Date(org.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/master/organizacoes/${org.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-purple-400 hover:text-purple-300 hover:underline"
                        >
                          Detalhes <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
