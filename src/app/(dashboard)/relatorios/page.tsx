import { getExecutiveReportAction, getFinancialReportAction } from './actions';
import { KpiCard } from '@/components/reports/KpiCard';
import { SimpleLineChart } from '@/components/reports/SimpleChart';
import { formatCurrency } from '@/lib/reports';
import { DollarSign, TrendingUp, TrendingDown, Wallet, Users, Receipt, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}

export default async function ExecutiveReportPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const period = resolvedParams.period || 'this_month';
  const start = resolvedParams.start;
  const end = resolvedParams.end;

  const data = await getExecutiveReportAction(period, start, end);
  const finData = await getFinancialReportAction(period, start, end).catch(() => null);

  const curr = data.current || {};
  const comp = data.comparisons || {};

  return (
    <div className="space-y-6">
      {/* Cards de KPIs Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Produção Operacional"
          subtitle="Valor comercial dos serviços concluídos"
          value={formatCurrency(curr.producao_operacional)}
          icon={TrendingUp}
          comparison={comp.producao}
          variant="highlight"
          tooltip="Soma de appointment_services.total em atendimentos concluídos no período (inclui cobertos por planos)."
        />

        <KpiCard
          title="Recebimentos"
          subtitle="Transações de entrada efetivas"
          value={formatCurrency(curr.recebimentos)}
          icon={DollarSign}
          comparison={comp.recebimentos}
          variant="success"
          tooltip="Soma de financial_transactions do tipo 'income' sem anulação."
        />

        <KpiCard
          title="Despesas Pagas"
          subtitle="Saídas operacionais executadas"
          value={formatCurrency(curr.despesas_pagas)}
          icon={TrendingDown}
          comparison={comp.despesas}
          variant="danger"
          tooltip="Soma de financial_transactions do tipo 'expense' sem anulação."
        />

        <KpiCard
          title="Resultado de Caixa"
          subtitle="Recebimentos - Despesas Pagas"
          value={formatCurrency(curr.resultado_caixa)}
          icon={Wallet}
          comparison={comp.resultado_caixa}
          variant={curr.resultado_caixa >= 0 ? 'success' : 'danger'}
          tooltip="Diferença financeira líquida entre recebimentos e despesas pagas no período."
        />
      </div>

      {/* Grid Secundário de Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Ticket Médio Operacional"
          value={formatCurrency(curr.ticket_medio_operacional)}
          icon={Receipt}
          comparison={comp.ticket_operacional}
          tooltip="Produção Operacional / Atendimentos Concluídos."
        />

        <KpiCard
          title="Clientes Atendidos"
          value={curr.clientes_atendidos_count || 0}
          icon={Users}
          comparison={comp.atendimentos}
          tooltip="Clientes distintos com atendimentos concluídos no período."
        />

        <KpiCard
          title="Contas a Receber"
          subtitle={`Vencidos: ${formatCurrency(curr.contas_a_receber_vencidas)}`}
          value={formatCurrency(curr.contas_a_receber_total)}
          icon={DollarSign}
          tooltip="Saldo pendente total em contas a receber."
        />

        <KpiCard
          title="Contas a Pagar"
          subtitle={`Vencidos: ${formatCurrency(curr.contas_a_pagar_vencidas)}`}
          value={formatCurrency(curr.contas_a_pagar_total)}
          icon={Wallet}
          tooltip="Saldo pendente total em contas a pagar."
        />
      </div>

      {/* Gráfico Temporal */}
      {finData?.current?.series_temporais && (
        <SimpleLineChart
          title="Desempenho Temporal (Produção vs Recebimentos vs Despesas)"
          data={(finData.current.series_temporais || []).map((s: any) => ({
            date: s.data_periodo,
            producao: Number(s.producao || 0),
            recebimentos: Number(s.recebimentos || 0),
            despesas: Number(s.despesas || 0),
            resultado_caixa: Number(s.resultado_caixa || 0),
          }))}
        />
      )}

      {/* Atalhos para Drill-Down */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <Link
          href={`/relatorios/clientes?period=${period}`}
          className="p-4 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-amber-500/40 transition-all flex items-center justify-between group shadow-xs"
        >
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-amber-600 dark:group-hover:text-amber-400">Análise de Clientes & Retenção</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Recorrência, novos clientes e alertas inativos.</p>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-500 dark:text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-all" />
        </Link>

        <Link
          href={`/relatorios/servicos?period=${period}`}
          className="p-4 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-amber-500/40 transition-all flex items-center justify-between group shadow-xs"
        >
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-amber-600 dark:group-hover:text-amber-400">Ranking de Serviços</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Serviços mais produzidos e categorias.</p>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-500 dark:text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-all" />
        </Link>

        <Link
          href={`/relatorios/profissionais?period=${period}`}
          className="p-4 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-amber-500/40 transition-all flex items-center justify-between group shadow-xs"
        >
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-amber-600 dark:group-hover:text-amber-400">Produção de Profissionais</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Desempenho por profissional e comissões.</p>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-500 dark:text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-all" />
        </Link>
      </div>
    </div>
  );
}
