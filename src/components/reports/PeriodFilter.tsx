'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Calendar, Filter } from 'lucide-react';

export function PeriodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPeriod = searchParams.get('period') || 'this_month';
  const [customStart, setCustomStart] = useState(searchParams.get('start') || '');
  const [customEnd, setCustomEnd] = useState(searchParams.get('end') || '');
  const [showCustomModal, setShowCustomModal] = useState(false);

  const handlePeriodChange = (periodKey: string) => {
    if (periodKey === 'custom') {
      setShowCustomModal(true);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', periodKey);
    params.delete('start');
    params.delete('end');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', 'custom');
    params.set('start', customStart);
    params.set('end', customEnd);
    setShowCustomModal(false);
    router.push(`${pathname}?${params.toString()}`);
  };

  const periodLabels: Record<string, string> = {
    today: 'Hoje',
    yesterday: 'Ontem',
    this_week: 'Esta Semana',
    last_week: 'Semana Passada',
    this_month: 'Este Mês',
    last_month: 'Mês Passado',
    last_30_days: 'Últimos 30 dias',
    this_year: 'Este Ano',
    custom: customStart && customEnd ? `${customStart} até ${customEnd}` : 'Personalizado',
  };

  return (
    <div className="flex flex-wrap items-center gap-2 bg-slate-900/80 p-2 rounded-2xl border border-slate-800 backdrop-blur-md">
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 rounded-xl">
        <Calendar className="h-4 w-4" />
        <span>Período:</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {[
          { key: 'today', label: 'Hoje' },
          { key: 'yesterday', label: 'Ontem' },
          { key: 'this_week', label: 'Esta Semana' },
          { key: 'this_month', label: 'Este Mês' },
          { key: 'last_month', label: 'Mês Passado' },
          { key: 'last_30_days', label: '30 dias' },
          { key: 'this_year', label: 'Este Ano' },
          { key: 'custom', label: 'Personalizado' },
        ].map((item) => {
          const isActive = currentPeriod === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handlePeriodChange(item.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-lg">
              <Filter className="h-5 w-5" />
              <span>Período Personalizado</span>
            </div>
            <p className="text-xs text-slate-400">
              Selecione o intervalo de datas inicial e final para filtrar as métricas gerenciais.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Data Inicial</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Data Final</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCustomModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyCustom}
                disabled={!customStart || !customEnd}
                className="px-4 py-2 text-xs font-bold bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 disabled:opacity-50"
              >
                Aplicar Filtro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
