import React from 'react';
import { fetchSystemAssetsAction, getSystemBrandingAction } from '@/lib/master/system-assets';
import { Crown, Image as ImageIcon, Video, ShieldCheck, Sparkles } from 'lucide-react';
import SystemIdentityClientView from './SystemIdentityClientView';

export const revalidate = 0;

export default async function MasterSystemIdentityPage() {
  let assets: any[] = [];
  let branding: any = null;

  try {
    assets = await fetchSystemAssetsAction();
    branding = await getSystemBrandingAction();
  } catch (err) {
    console.error('Erro ao carregar ativos do sistema:', err);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-400" /> Identidade do Sistema
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Administração dinâmica da Logo Oficial, Logo Compacta, Favicon e Mídia de Abertura / Splash Screen.
          </p>
        </div>
      </div>

      <SystemIdentityClientView initialAssets={assets} initialBranding={branding} />
    </div>
  );
}
