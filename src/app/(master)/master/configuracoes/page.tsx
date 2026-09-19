import React from 'react';
import { fetchPlatformSettings } from '@/lib/master/actions';
import { Settings, ShieldAlert, Sliders } from 'lucide-react';
import MasterSettingsClientForm from './MasterSettingsClientForm';

export const revalidate = 0;

export default async function MasterSettingsPage() {
  let settings: any[] = [];

  try {
    settings = await fetchPlatformSettings();
  } catch (err) {
    console.error('Erro ao carregar configurações:', err);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Configurações da Plataforma</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Parâmetros globais do SaaS, modo de manutenção e controle de cadastros públicos.
          </p>
        </div>
      </div>

      <MasterSettingsClientForm initialSettings={settings} />
    </div>
  );
}
