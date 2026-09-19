import Link from 'next/link';
import { PeriodFilter } from '@/components/reports/PeriodFilter';
import { BarChart3, Users, Wrench, UserCheck, PackageCheck, Wallet } from 'lucide-react';

export default function RelatoriosLayout({ children }: { children: React.ReactNode }) {
  const tabs = [
    { label: 'Visão Geral', href: '/relatorios', icon: BarChart3, exact: true },
    { label: 'Clientes & Retenção', href: '/relatorios/clientes', icon: Users },
    { label: 'Serviços', href: '/relatorios/servicos', icon: Wrench },
    { label: 'Profissionais', href: '/relatorios/profissionais', icon: UserCheck },
    { label: 'Pacotes & Planos', href: '/relatorios/pacotes', icon: PackageCheck },
    { label: 'Financeiro', href: '/relatorios/financeiro', icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      {/* Dynamic Header & Global Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-amber-400" />
            Relatórios e Inteligência Gerencial
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Análise consolidada determinística de produção, recebimentos, clientes, profissionais e pacotes.
          </p>
        </div>

        <PeriodFilter />
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-slate-800/60 no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all shrink-0 border border-transparent hover:border-slate-700/60"
            >
              <Icon className="h-4 w-4 text-amber-400" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="pt-2">{children}</div>
    </div>
  );
}
