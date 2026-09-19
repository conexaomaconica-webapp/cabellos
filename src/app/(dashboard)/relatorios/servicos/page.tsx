import { getServicesReportAction } from '../actions';
import { KpiCard } from '@/components/reports/KpiCard';
import { SimpleBarChart } from '@/components/reports/SimpleChart';
import { ExportCsvButton } from '@/components/reports/ExportCsvButton';
import { formatCurrency } from '@/lib/reports';
import { Wrench, FolderKanban, Receipt, TrendingUp, Layers } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ period?: string; start?: string; end?: string; service_id?: string; category_id?: string }>;
}

export default async function ServicesReportPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const period = resolvedParams.period || 'this_month';
  const start = resolvedParams.start;
  const end = resolvedParams.end;
  const serviceId = resolvedParams.service_id;
  const categoryId = resolvedParams.category_id;

  const data = await getServicesReportAction(period, start, end, serviceId, categoryId);
  const curr = data.current || {};
  const ranking = curr.ranking_servicos || [];

  return (
    <div className="space-y-6">
      {/* Header com botão de Exportação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Relatório de Serviços e Categorias</h2>
          <p className="text-xs text-slate-400">Desempenho comercial, execução por pacote e participação das categorias.</p>
        </div>

        <ExportCsvButton reportType="servicos" label="Exportar CSV Serviços" />
      </div>

      {/* Cards de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Produção Total"
          subtitle="Valor comercial dos serviços"
          value={formatCurrency(curr.total_producao)}
          icon={TrendingUp}
          variant="highlight"
        />

        <KpiCard
          title="Serviços Executados"
          subtitle="Itens concluídos"
          value={curr.total_quantidade || 0}
          icon={Wrench}
        />

        <KpiCard
          title="Categorias Ativas"
          subtitle="Segmentos no período"
          value={(curr.por_categoria || []).length}
          icon={FolderKanban}
        />

        <KpiCard
          title="Serviços Distintos"
          subtitle="Catálogo no período"
          value={ranking.length}
          icon={Layers}
        />
      </div>

      {/* Gráfico de Barras - Top Serviços */}
      <SimpleBarChart
        title="Top 10 Serviços por Produção Comercial (R$)"
        data={ranking.slice(0, 10).map((s: any) => ({
          label: s.service_name,
          value: Number(s.producao_total || 0),
        }))}
      />

      {/* Tabela de Ranking de Serviços */}
      <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">Ranking Detalhado de Serviços</h3>
          <span className="text-xs text-slate-400">Total listados: {ranking.length}</span>
        </div>

        {ranking.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">Nenhum serviço concluído no período selecionado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase">
                  <th className="py-2.5 px-3">Serviço</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3 text-center">Quantidade</th>
                  <th className="py-2.5 px-3 text-right">Produção Total</th>
                  <th className="py-2.5 px-3 text-right text-indigo-400">Coberto por Plano</th>
                  <th className="py-2.5 px-3 text-right text-emerald-400">Cobrado Direto</th>
                  <th className="py-2.5 px-3 text-right">Ticket Médio</th>
                  <th className="py-2.5 px-3 text-right">% Produção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ranking.map((s: any) => (
                  <tr key={s.service_id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-white">{s.service_name}</td>
                    <td className="py-2.5 px-3 text-slate-400">{s.category_name || 'Sem Categoria'}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-200">{s.quantidade}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-400">{formatCurrency(s.producao_total)}</td>
                    <td className="py-2.5 px-3 text-right text-indigo-400 font-medium">{formatCurrency(s.producao_plano)}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-medium">{formatCurrency(s.producao_direta)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-300">{formatCurrency(s.ticket_medio)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-200">{s.percentual_producao}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Agrupamento por Categoria */}
      <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
        <h3 className="font-bold text-white text-sm">Produção por Categoria de Serviço</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(curr.por_categoria || []).map((cat: any, idx: number) => (
            <div key={idx} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white">{cat.category_name}</span>
                <span className="text-amber-400 font-bold">{cat.percentual_producao}%</span>
              </div>
              <div className="text-lg font-extrabold text-amber-400">{formatCurrency(cat.producao_total)}</div>
              <div className="text-[11px] text-slate-500">{cat.quantidade} execuções no período</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
