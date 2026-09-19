import { getProfessionalsReportAction } from '../actions';
import { KpiCard } from '@/components/reports/KpiCard';
import { SimpleBarChart } from '@/components/reports/SimpleChart';
import { ExportCsvButton } from '@/components/reports/ExportCsvButton';
import { formatCurrency } from '@/lib/reports';
import { UserCheck, Award, TrendingUp, DollarSign } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ period?: string; start?: string; end?: string; professional_id?: string }>;
}

export default async function ProfessionalsReportPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const period = resolvedParams.period || 'this_month';
  const start = resolvedParams.start;
  const end = resolvedParams.end;
  const profId = resolvedParams.professional_id;

  const data = await getProfessionalsReportAction(period, start, end, profId);
  const professionals = data.current?.profissionais || [];

  const totalProducao = professionals.reduce((acc: number, p: any) => acc + Number(p.producao_operacional || 0), 0);
  const totalComissao = professionals.reduce((acc: number, p: any) => acc + Number(p.comissao_gerada || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header com botão de Exportação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Desempenho por Profissional</h2>
          <p className="text-xs text-slate-400">Produção operacional por item executado, ticket médio e apuração de comissões.</p>
        </div>

        <ExportCsvButton reportType="profissionais" label="Exportar CSV Profissionais" />
      </div>

      {/* Cards de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Produção Total Equipe"
          subtitle="Soma de produções individuais"
          value={formatCurrency(totalProducao)}
          icon={TrendingUp}
          variant="highlight"
        />

        <KpiCard
          title="Comissões Geradas"
          subtitle="Snapshot histórico acumulado"
          value={formatCurrency(totalComissao)}
          icon={DollarSign}
          variant="success"
        />

        <KpiCard
          title="Profissionais Ativos"
          subtitle="Com registros no período"
          value={professionals.length}
          icon={UserCheck}
        />

        <KpiCard
          title="Média de Produção/Prof"
          subtitle="Produção / Profissionais"
          value={formatCurrency(professionals.length > 0 ? totalProducao / professionals.length : 0)}
          icon={Award}
        />
      </div>

      {/* Gráfico Ranking Produção */}
      <SimpleBarChart
        title="Ranking de Produção Operacional por Profissional (R$)"
        data={professionals.map((p: any) => ({
          label: p.professional_name,
          value: Number(p.producao_operacional || 0),
        }))}
      />

      {/* Tabela de Profissionais */}
      <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
        <h3 className="font-bold text-white text-sm">Produção Operacional e Comissões</h3>

        {professionals.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">Nenhum profissional com produção registrada no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase">
                  <th className="py-2.5 px-3">Profissional</th>
                  <th className="py-2.5 px-3 text-center">Atendimentos</th>
                  <th className="py-2.5 px-3 text-center">Serviços</th>
                  <th className="py-2.5 px-3 text-center">Clientes Unqs</th>
                  <th className="py-2.5 px-3 text-right">Produção Operacional</th>
                  <th className="py-2.5 px-3 text-right">Ticket Médio</th>
                  <th className="py-2.5 px-3 text-right text-indigo-400">Comissão Calculada</th>
                  <th className="py-2.5 px-3 text-right text-amber-400">Comissão Aprovada</th>
                  <th className="py-2.5 px-3 text-right text-emerald-400">Comissão Paga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {professionals.map((p: any) => (
                  <tr key={p.professional_id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-white">{p.professional_name}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-200">{p.atendimentos_count}</td>
                    <td className="py-2.5 px-3 text-center text-slate-300">{p.servicos_count}</td>
                    <td className="py-2.5 px-3 text-center text-slate-300">{p.clientes_distintos}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-400">{formatCurrency(p.producao_operacional)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-300">{formatCurrency(p.ticket_medio_operacional)}</td>
                    <td className="py-2.5 px-3 text-right text-indigo-400 font-medium">{formatCurrency(p.comissao_calculada)}</td>
                    <td className="py-2.5 px-3 text-right text-amber-400 font-medium">{formatCurrency(p.comissao_aprovada)}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">{formatCurrency(p.comissao_paga)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
