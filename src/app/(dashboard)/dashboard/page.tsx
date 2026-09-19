import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  UserCheck,
  Wrench,
  Plus,
  Sparkles,
  CalendarCheck2,
  DollarSign,
  TrendingUp,
  UserCheck2,
  Clock,
  AlertTriangle,
  Send,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  // Data atual em YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  const d7 = new Date();
  d7.setDate(d7.getDate() + 7);
  const d7Str = d7.toISOString().split('T')[0];

  // Executar buscas em paralelo
  const [
    { count: clientsCount },
    { count: professionalsCount },
    { count: servicesCount },
    { data: activeOrg },
    { data: todayAppointments },
    { count: returnsTodayCount },
    { count: returnsOverdueCount },
    { count: returnsNext7Count },
    { count: contactsTodayCount },
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
    supabase
      .from('return_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', activeOrgId!)
      .in('status', ['due', 'upcoming'])
      .eq('expected_return_at', todayStr),
    supabase
      .from('return_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', activeOrgId!)
      .eq('status', 'overdue'),
    supabase
      .from('return_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', activeOrgId!)
      .in('status', ['upcoming', 'due'])
      .gte('expected_return_at', todayStr)
      .lte('expected_return_at', d7Str),
    supabase
      .from('client_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', activeOrgId!)
      .gte('contacted_at', `${todayStr}T00:00:00.000Z`),
  ]);

  // Cálculo das métricas de hoje
  const completedTodayCount = todayAppointments?.length || 0;
  const revenueToday = todayAppointments?.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0) || 0;
  const averageTicketToday = completedTodayCount > 0 ? revenueToday / completedTodayCount : 0;
  const uniqueClientsToday = new Set(todayAppointments?.map((a) => a.client_id)).size;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Banner de Boas-Vindas */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900/10 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border border-amber-500/20 dark:border-slate-800 p-6 shadow-sm relative overflow-hidden transition-all">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-2">
              <Sparkles className="h-3.5 w-3.5" /> Retornos & Engajamento por Serviço
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {activeOrg?.name || 'Bem-vindo ao Cabellos'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
              Acompanhe retornos previstos por serviço, contate clientes em atraso e potencialize a recorrência do salão.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link href="/relatorios">
              <Button variant="default" className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                <BarChart3 className="h-4 w-4 mr-1.5" /> Ver Relatórios
              </Button>
            </Link>
            <Link href="/retornos">
              <Button variant="default" className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                <Clock className="h-4 w-4 mr-1.5" /> Central de Retornos
              </Button>
            </Link>
            <Link href="/atendimentos/novo">
              <Button variant="default" className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                <Plus className="h-4 w-4 mr-1.5" /> Novo Atendimento
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* SEÇÃO 1: INDICADORES DA CENTRAL DE RETORNOS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" /> Indicadores de Retorno & Recorrência
          </h2>
          <Link href="/retornos" className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold">
            Ver Central de Retornos <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Retornos Hoje */}
          <Link href="/retornos?tab=hoje">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-500/50 transition-all shadow-xs hover:shadow-md cursor-pointer group">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">Retornos Previstos Hoje</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                  <Clock className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{returnsTodayCount || 0}</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Alertas com vencimento hoje</p>
              </CardContent>
            </Card>
          </Link>

          {/* Retornos Atrasados */}
          <Link href="/retornos?tab=atrasados">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-red-500/50 transition-all shadow-xs hover:shadow-md cursor-pointer group">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">Retornos em Atraso</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{returnsOverdueCount || 0}</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Clientes que ultrapassaram a data</p>
              </CardContent>
            </Card>
          </Link>

          {/* Próximos 7 Dias */}
          <Link href="/retornos?tab=proximos_7">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-500/50 transition-all shadow-xs hover:shadow-md cursor-pointer group">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">Próximos 7 Dias</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <CalendarCheck2 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{returnsNext7Count || 0}</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Alertas da próxima semana</p>
              </CardContent>
            </Card>
          </Link>

          {/* Contatados Hoje */}
          <Link href="/retornos?tab=contatados">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-all shadow-xs hover:shadow-md cursor-pointer group">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">Contatados Hoje</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                  <Send className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{contactsTodayCount || 0}</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Mensagens registradas hoje</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* SEÇÃO 2: MÉTRICAS OPERACIONAIS DE HOJE */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-200 mb-3 flex items-center gap-2">
          <CalendarCheck2 className="h-4 w-4 text-amber-500 dark:text-amber-400" /> Operação de Hoje ({new Date().toLocaleDateString('pt-BR')})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">Atendimentos Hoje</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <CalendarCheck2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{completedTodayCount}</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Concluídos na data</p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">Faturamento Hoje</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <DollarSign className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(revenueToday)}</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Receita de atendimentos</p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">Ticket Médio Hoje</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(averageTicketToday)}</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Média por atendimento</p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 dark:text-slate-400">Clientes Atendidos</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <UserCheck2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{uniqueClientsToday}</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Clientes distintos hoje</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cards de Métricas Cadastrais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-300 dark:border-slate-700 transition-all shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Total de Clientes</CardTitle>
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{clientsCount || 0}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Clientes cadastrados na organização</p>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <Link href="/clientes" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1">
                Ver todos →
              </Link>
              <Link href="/clientes/novo" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white font-medium">
                + Cadastrar
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-300 dark:border-slate-700 transition-all shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Equipe de Profissionais</CardTitle>
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{professionalsCount || 0}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Atendentes e especialistas</p>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <Link href="/cadastros/profissionais" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1">
                Gerenciar equipe →
              </Link>
              <Link href="/cadastros/profissionais/novo" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white font-medium">
                + Adicionar
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-300 dark:border-slate-700 transition-all shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Catálogo de Serviços</CardTitle>
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Wrench className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{servicesCount || 0}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Serviços e procedimentos ativos</p>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <Link href="/cadastros/servicos" className="text-purple-600 dark:text-purple-400 font-semibold hover:underline flex items-center gap-1">
                Ver catálogo →
              </Link>
              <Link href="/cadastros/servicos/novo" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white font-medium">
                + Adicionar
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
