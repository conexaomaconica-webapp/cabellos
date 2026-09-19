import React from 'react';
import { ShieldAlert } from 'lucide-react';

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
        <div className="p-4 bg-purple-950/60 border border-purple-800/40 rounded-2xl w-fit mx-auto text-purple-400">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Sistema em Manutenção Programada</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          A plataforma Cabellos está passando por atualizações importantes de infraestrutura e segurança.
          Voltaremos a operar normalmente em breve. Agradecemos a compreensão.
        </p>
      </div>
    </div>
  );
}
