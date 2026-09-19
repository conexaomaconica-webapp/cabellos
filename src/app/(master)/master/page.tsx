import React from 'react';
import Link from 'next/link';
import { fetchGlobalKPIs } from '@/lib/master/actions';
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  PlusCircle,
  ShieldCheck,
  HardDriveDownload,
  CreditCard,
} from 'lucide-react';

export const revalidate = 0;

export default async function MasterDashboardPage() {
  let kpis = {
    active_tenants: 0,
    trial_tenants: 0,
    suspended_tenants: 0,
    mrr: 0,
    arr: 0,
    total_users: 0,
    total_clients: 0,
  };

  try {
    kpis = await fetchGlobalKPIs();
  } catch (err) {
    console.error('Erro ao carregar KPIs Master:', err);
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-8">
      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Visão Geral da Plataforma SaaS</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Métricas de receita recorrente, salões cadastrados e integridade global do Cabellos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/master/organizacoes"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-slate-900 dark:text-white font-medium text-sm transition-all shadow-lg shadow-purple-900/30"
          >
            <PlusCircle className="h-4 w-4" /> Novo Salão
          </Link>
        </div>
      </div>

      {/* GRID DE CARDS KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">MRR (Mensal Recorrente)</span>
            <DollarSign className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{formatCurrency(kpis.mrr)}</p>
          <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
            <TrendingUp className="h-3.5 w-3.5" /> Assinaturas ativas no SaaS
          </span>
        </div>

        {/* ARR */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">ARR (Anual Projetado)</span>
            <TrendingUp className="h-5 w-5 text-purple-400" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{formatCurrency(kpis.arr)}</p>
          <span className="text-xs text-purple-400 font-medium">Faturamento anual projetado</span>
        </div>

        {/* SALÕES ATIVOS */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Salões Ativos</span>
            <Building2 className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{kpis.active_tenants}</p>
          <span className="text-xs text-slate-500 dark:text-slate-400">Tenants operando normalmente</span>
        </div>

        {/* TRIALS */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Salões em Trial</span>
            <Clock className="h-5 w-5 text-amber-400" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{kpis.trial_tenants}</p>
          <span className="text-xs text-amber-400 font-medium">Em período de testes</span>
        </div>
      </div>

      {/* METRICAS SECUNDÁRIAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Salões Suspensos</p>
            <p className="text-xl font-bold text-slate-100">{kpis.suspended_tenants}</p>
          </div>
          <AlertTriangle className="h-6 w-6 text-rose-400" />
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total de Usuários</p>
            <p className="text-xl font-bold text-slate-100">{kpis.total_users}</p>
          </div>
          <Users className="h-6 w-6 text-purple-400" />
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Base Global de Clientes</p>
            <p className="text-xl font-bold text-slate-100">{kpis.total_clients}</p>
          </div>
          <Building2 className="h-6 w-6 text-emerald-400" />
        </div>
      </div>

      {/* ATALHOS RÁPIDOS */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ações Administrativas Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/master/organizacoes"
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/80 transition-all space-y-2 group"
          >
            <Building2 className="h-6 w-6 text-purple-400 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Gerenciar Salões</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Ativar, suspender, arquivar e visualizar dados dos tenants.</p>
          </Link>

          <Link
            href="/master/planos"
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/80 transition-all space-y-2 group"
          >
            <CreditCard className="h-6 w-6 text-purple-400 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Planos SaaS</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configurar preços, limites de usuários/profissionais e recursos.</p>
          </Link>

          <Link
            href="/master/backups"
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/80 transition-all space-y-2 group"
          >
            <HardDriveDownload className="h-6 w-6 text-purple-400 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Exportação & Backups</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Geração de backups lógicos privados por tenant e URLs assinadas.</p>
          </Link>

          <Link
            href="/master/auditoria"
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/80 transition-all space-y-2 group"
          >
            <ShieldCheck className="h-6 w-6 text-purple-400 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Trilha de Auditoria</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Auditoria imutável de todas as ações administrativas do Master.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
