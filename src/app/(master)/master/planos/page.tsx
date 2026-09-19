import React from 'react';
import { fetchSaasPlans } from '@/lib/master/actions';
import { CreditCard, CheckCircle2, XCircle, PlusCircle } from 'lucide-react';
import MasterPlanClientModal from './MasterPlanClientModal';

export const revalidate = 0;

export default async function MasterPlansPage() {
  let plans: any[] = [];

  try {
    plans = await fetchSaasPlans();
  } catch (err) {
    console.error('Erro ao carregar planos:', err);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Planos Comerciais SaaS</h1>
          <p className="text-sm text-slate-400">
            Cadastro de planos, preços mensal/anual, limites de usuários/profissionais e matriz de recursos.
          </p>
        </div>

        <MasterPlanClientModal />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {plan.slug}
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">R$ {plan.monthly_price}</span>
                <span className="text-xs text-slate-400">/ mês</span>
              </div>
              <p className="text-xs text-slate-400">Anual: R$ {plan.yearly_price} | Trial: {plan.trial_days} dias</p>

              <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs text-slate-300">
                <p className="font-bold text-slate-200 uppercase tracking-wider text-[11px] mb-2">Limites do Plano:</p>
                <p>• Max Usuários: <strong className="text-white">{plan.max_users}</strong></p>
                <p>• Max Profissionais: <strong className="text-white">{plan.max_professionals}</strong></p>
                <p>• Max Clientes: <strong className="text-white">{plan.max_clients}</strong></p>
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs text-slate-300">
                <p className="font-bold text-slate-200 uppercase tracking-wider text-[11px] mb-2">Módulos Inclusos:</p>
                {plan.saas_plan_features?.map((feat: any) => (
                  <div key={feat.id} className="flex items-center gap-2">
                    {feat.enabled ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    )}
                    <span className={feat.enabled ? 'text-slate-200' : 'text-slate-500 line-through'}>
                      {feat.feature_key}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
