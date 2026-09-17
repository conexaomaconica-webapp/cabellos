import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserCheck, Wrench, FolderKanban, Plus, Sparkles, CalendarCheck2, DollarSign, TrendingUp, UserCheck2 } from 'lucide-react';
import Link from 'next/link';

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  // Data atual em YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // Executar buscas em paralelo
  const [
    { count: clientsCount },
    { count: professionalsCount },
    { count: servicesCount },
    { data: activeOrg },
    { data: todayAppointments },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('organization_id', activeOrgId!).eq('is_active', true),
    supabase.from('professionals').select('*', { count: 'exact', head: true }).eq('organization_id', activeOrgId!).eq('is_active', true),
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('organization_id', activeOrgId!).eq('is_active', true),
    supabase.from('organizations').select('*').eq('id', activeOrgId!).single(),
    supabase
      .from('appointments')
      .select('id, total_amount, client_id')
      .eq('organization_id', activeOrgId!)
      .eq('date', todayStr)
      .eq('status', 'completed'),
  ]);

  // Cálculo das métricas de hoje
  const completedTodayCount = todayAppointments?.length || 0;
  const revenueToday = todayAppointments?.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0) || 0;
  const averageTicketToday = completedTodayCount > 0 ? revenueToday / completedTodayCount : 0;
  
  // Clientes únicos atendidos hoje
  const uniqueClientsToday = new Set(todayAppointments?.map((a) => a.client_id)).size;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Banner de Boas-Vindas */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
              <Sparkles className="h-3.5 w-3.5" /> Sprint 2 — Atendimentos & Operação
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {activeOrg?.name || 'Bem-vindo ao Cabellos'}
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              Gerencie atendimentos, clientes, equipe de profissionais e acompanhe os indicadores em tempo real.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/atendimentos/novo">
              <Button variant="default" className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold shadow-lg">
                <Plus className="h-4 w-4 mr-1.5" /> Novo Atendimento
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Métricas Operacionais de Hoje */}
      <div>
        <h2 className="text-base font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <CalendarCheck2 className="h-4 w-4 text-amber-400" /> Resumo do Dia ({new Date().toLocaleDateString('pt-BR')})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Atendimentos Hoje */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-400">Atendimentos Hoje</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <CalendarCheck2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{completedTodayCount}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Concluídos na data</p>
            </CardContent>
          </Card>

          {/* Faturamento Hoje */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-400">Faturamento Hoje</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <DollarSign className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">{formatCurrency(revenueToday)}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Receita de atendimentos</p>
            </CardContent>
          </Card>

          {/* Ticket Médio Hoje */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-400">Ticket Médio Hoje</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">{formatCurrency(averageTicketToday)}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Média por atendimento</p>
            </CardContent>
          </Card>

          {/* Clientes Atendidos Hoje */}
          <Card className="bg-slate-900 border-slate-800 text-white shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-400">Clientes Atendidos</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <UserCheck2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-400">{uniqueClientsToday}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Clientes distintos hoje</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cards de Métricas Cadastrais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card Clientes */}
        <Card className="bg-slate-900 border-slate-800 text-white hover:border-slate-700 transition-all shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total de Clientes</CardTitle>
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{clientsCount || 0}</div>
            <p className="text-xs text-slate-500 mt-1">Clientes cadastrados na organização</p>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <Link href="/clientes" className="text-blue-400 font-medium hover:underline flex items-center gap-1">
                Ver todos →
              </Link>
              <Link href="/clientes/novo" className="text-slate-400 hover:text-white">
                + Cadastrar
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Card Profissionais */}
        <Card className="bg-slate-900 border-slate-800 text-white hover:border-slate-700 transition-all shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Equipe de Profissionais</CardTitle>
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{professionalsCount || 0}</div>
            <p className="text-xs text-slate-500 mt-1">Atendentes e especialistas</p>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <Link href="/cadastros/profissionais" className="text-emerald-400 font-medium hover:underline flex items-center gap-1">
                Gerenciar equipe →
              </Link>
              <Link href="/cadastros/profissionais/novo" className="text-slate-400 hover:text-white">
                + Adicionar
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Card Serviços */}
        <Card className="bg-slate-900 border-slate-800 text-white hover:border-slate-700 transition-all shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Catálogo de Serviços</CardTitle>
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Wrench className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{servicesCount || 0}</div>
            <p className="text-xs text-slate-500 mt-1">Serviços e procedimentos ativos</p>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <Link href="/cadastros/servicos" className="text-purple-400 font-medium hover:underline flex items-center gap-1">
                Ver catálogo →
              </Link>
              <Link href="/cadastros/servicos/novo" className="text-slate-400 hover:text-white">
                + Adicionar
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção de Atalhos Rápidos */}
      <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-white">Ações Rápidas</CardTitle>
          <CardDescription className="text-slate-400">
            Acesse diretamente as rotas principais da operação do salão
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/atendimentos/novo"
            className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 hover:border-amber-500/50 transition-all group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
              <CalendarCheck2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-100">Novo Atendimento</p>
              <p className="text-xs text-slate-400">Concluir serviço</p>
            </div>
          </Link>

          <Link
            href="/atendimentos"
            className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 hover:border-emerald-500/50 transition-all group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-100">Atendimentos</p>
              <p className="text-xs text-slate-400">Lista e histórico</p>
            </div>
          </Link>

          <Link
            href="/clientes/novo"
            className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 hover:border-blue-500/50 transition-all group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-105 transition-transform">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-100">Novo Cliente</p>
              <p className="text-xs text-slate-400">Cadastrar cliente</p>
            </div>
          </Link>

          <Link
            href="/cadastros/servicos"
            className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 hover:border-purple-500/50 transition-all group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-105 transition-transform">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-100">Catálogo Serviços</p>
              <p className="text-xs text-slate-400">Gerenciar preços</p>
            </div>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
