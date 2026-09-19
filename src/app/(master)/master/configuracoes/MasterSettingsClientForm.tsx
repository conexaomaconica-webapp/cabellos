'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePlatformSetting } from '@/lib/master/actions';
import { Settings, ShieldAlert, Sliders, CheckCircle2 } from 'lucide-react';

export default function MasterSettingsClientForm({ initialSettings }: { initialSettings: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const getVal = (key: string, defaultVal: any) => {
    const item = initialSettings.find((s) => s.key === key);
    if (!item) return defaultVal;
    try {
      return typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
    } catch {
      return item.value ?? defaultVal;
    }
  };

  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(Boolean(getVal('maintenance_mode', false)));
  const [allowSignups, setAllowSignups] = useState<boolean>(Boolean(getVal('allow_new_signups', true)));
  const [trialDays, setTrialDays] = useState<number>(Number(getVal('default_trial_days', 14)));
  const [retentionDays, setRetentionDays] = useState<number>(Number(getVal('backup_retention_days', 30)));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      await updatePlatformSetting('maintenance_mode', maintenanceMode);
      await updatePlatformSetting('allow_new_signups', allowSignups);
      await updatePlatformSetting('default_trial_days', trialDays);
      await updatePlatformSetting('backup_retention_days', retentionDays);

      setMsg('Configurações salvas com sucesso!');
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Falha ao atualizar configurações.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      {msg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2 font-bold">
          <CheckCircle2 className="h-4 w-4" />
          {msg}
        </div>
      )}

      {/* MODO DE MANUTENÇÃO */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-400" /> Modo de Manutenção Global
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Quando ativo, redireciona todos os usuários de salões para a tela de manutenção. O Master continua acessando o `/master`.
            </p>
          </div>
          <input
            type="checkbox"
            checked={maintenanceMode}
            onChange={(e) => setMaintenanceMode(e.target.checked)}
            className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
          />
        </div>
      </div>

      {/* CADASTROS PÚBLICOS */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="h-5 w-5 text-purple-400" /> Permissão de Novos Cadastros Espontâneos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Se desabilitado, impede o onboarding público espontâneo. Login existente e convites do Master continuam válidos.
            </p>
          </div>
          <input
            type="checkbox"
            checked={allowSignups}
            onChange={(e) => setAllowSignups(e.target.checked)}
            className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
          />
        </div>
      </div>

      {/* PARAMETROS NUMÉRICOS */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Parâmetros de Operação</h3>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Dias Padrão de Trial</label>
            <input
              type="number"
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-purple-500 outline-none font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Dias de Retenção de Backup</label>
            <input
              type="number"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-purple-500 outline-none font-bold"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-slate-900 dark:text-white font-bold text-xs shadow-lg shadow-purple-900/30 transition-all disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </form>
  );
}
