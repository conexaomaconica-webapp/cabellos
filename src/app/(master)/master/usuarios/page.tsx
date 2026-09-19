import React from 'react';
import { fetchUsersGlobal } from '@/lib/master/actions';
import { Users, Crown, ShieldAlert, CheckCircle2 } from 'lucide-react';
import MasterUserRoleClientModal from './MasterUserRoleClientModal';

export const revalidate = 0;

export default async function MasterUsersPage() {
  let users: any[] = [];

  try {
    users = await fetchUsersGlobal();
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
  }

  const masterCount = users.filter((u) => u.system_role === 'master').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Usuários Globais do Sistema</h1>
          <p className="text-sm text-slate-400">
            Gerenciamento do papel global da plataforma (system_role = master / user) e salvaguarda do último Master.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-800/40 text-purple-300 text-xs font-bold">
          <Crown className="h-4 w-4" /> Masters Ativos: {masterCount}
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Papel no Sistema (system_role)</th>
                <th className="px-6 py-4">Organizações Associadas</th>
                <th className="px-6 py-4">Data de Cadastro</th>
                <th className="px-6 py-4 text-right">Alterar Papel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4 font-semibold text-white">
                    <div>
                      <p className="text-white font-bold">{u.full_name || 'Sem nome'}</p>
                      <p className="text-xs text-slate-400 font-normal">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.system_role === 'master' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        <Crown className="h-3.5 w-3.5" /> MASTER GLOBAL
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        USER (Comum)
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-300">
                    {u.organization_users?.length > 0 ? (
                      u.organization_users.map((ou: any) => ou.organizations?.name).join(', ')
                    ) : (
                      <span className="text-slate-500 italic">Sem salão (Apenas Master ou Pendente)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <MasterUserRoleClientModal
                      userId={u.id}
                      userEmail={u.email}
                      currentRole={u.system_role}
                      masterCount={masterCount}
                    />
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
