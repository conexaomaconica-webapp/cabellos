'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleSaasPlanStatus, deleteSaasPlan } from '@/lib/master/actions';
import { Power, PowerOff, Trash2 } from 'lucide-react';
import MasterPlanClientModal from './MasterPlanClientModal';

export default function PlanActions({ plan }: { plan: any }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    startTransition(async () => {
      try {
        setError(null);
        await toggleSaasPlanStatus(plan.id, !plan.is_active);
        router.refresh();
      } catch (err: any) {
        setError(err.message);
        alert(err.message);
      }
    });
  };

  const handleDelete = () => {
    if (!window.confirm(`Tem certeza que deseja excluir DEFINITIVAMENTE o plano "${plan.name}"? Isso pode quebrar organizações atreladas a ele!`)) {
      return;
    }
    
    startTransition(async () => {
      try {
        setError(null);
        await deleteSaasPlan(plan.id);
        router.refresh();
      } catch (err: any) {
        setError(err.message);
        alert(err.message);
      }
    });
  };

  return (
    <div className="flex items-center gap-1">
      {/* Botão Editar (Modal) */}
      <MasterPlanClientModal planToEdit={plan} />

      {/* Botão Ativar/Inativar */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`p-2 rounded-xl transition-colors ${
          plan.is_active
            ? 'bg-slate-100 dark:bg-slate-800 text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
        }`}
        title={plan.is_active ? 'Inativar Plano' : 'Ativar Plano'}
      >
        {plan.is_active ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
      </button>

      {/* Botão Excluir */}
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
        title="Excluir Definitivamente"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
