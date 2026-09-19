import React from 'react';
import { fetchSubscriptions } from '@/lib/master/actions';
import { Calendar, Building2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

export const revalidate = 0;

export default async function MasterSubscriptionsPage() {
  let subscriptions: any[] = [];

  try {
    subscriptions = await fetchSubscriptions();
  } catch (err) {
    console.error('Erro ao carregar assinaturas:', err);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Assinaturas SaaS do Cabellos</h1>
          <p className="text-sm text-slate-400">
            Controle de contratos ativos, vigência, status de pagamento e histórico de eventos.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Salão / Tenant</th>
                <th className="px-6 py-4">Plano Contratado</th>
                <th className="px-6 py-4">Status Assinatura</th>
                <th className="px-6 py-4">Ciclo</th>
                <th className="px-6 py-4">Preço Contratado</th>
                <th className="px-6 py-4 text-right">Vencimento Período</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma assinatura registrada.
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-purple-400 shrink-0" />
                        <span>{sub.organizations?.name || 'Salão'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-purple-300">
                      {sub.saas_plans?.name || 'Plano Legado'}
                    </td>
                    <td className="px-6 py-4">
                      {sub.status === 'active' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3.5 w-3.5" /> ATIVA
                        </span>
                      )}
                      {sub.status === 'trial' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="h-3.5 w-3.5" /> TRIAL
                        </span>
                      )}
                      {sub.status === 'suspended' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <AlertTriangle className="h-3.5 w-3.5" /> SUSPENSA
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs capitalize text-slate-300">
                      {sub.billing_cycle}
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      R$ {sub.price_snapshot}
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-slate-400">
                      {new Date(sub.current_period_end).toLocaleDateString('pt-BR')}
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
