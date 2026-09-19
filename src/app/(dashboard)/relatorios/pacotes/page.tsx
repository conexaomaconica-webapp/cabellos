import { getPackagesReportAction } from '../actions';
import { KpiCard } from '@/components/reports/KpiCard';
import { ExportCsvButton } from '@/components/reports/ExportCsvButton';
import { formatCurrency, formatDateBR } from '@/lib/reports';
import { PackageCheck, RefreshCw, DollarSign, Clock, Layers } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}

export default async function PackagesReportPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const period = resolvedParams.period || 'this_month';
  const start = resolvedParams.start;
  const end = resolvedParams.end;

  const data = await getPackagesReportAction(period, start, end);
  const curr = data.current || {};

  return (
    <div className="space-y-6">
      {/* Header com botão de Exportação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Relatório de Pacotes e Planos</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Contratos comercializados, utilização de serviços e taxa de renovação.</p>
        </div>

        <ExportCsvButton reportType="pacotes" label="Exportar CSV Pacotes" />
      </div>

      {/* Cards de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Contratos Vendidos"
          subtitle="Vendidos no período"
          value={curr.vendidos_count || 0}
          icon={PackageCheck}
          variant="highlight"
        />

        <KpiCard
          title="Recebimentos de Planos"
          subtitle="Entradas de vendas de pacotes"
          value={formatCurrency(curr.recebimentos_planos)}
          icon={DollarSign}
          variant="success"
        />

        <KpiCard
          title="Contratos Ativos"
          subtitle="Base total em vigor"
          value={curr.ativos_count || 0}
          icon={Layers}
        />

        <KpiCard
          title="Taxa de Renovação"
          subtitle="Contratos renovados / elegíveis"
          value={curr.taxa_renovacao !== null ? `${curr.taxa_renovacao}%` : 'Sem base suficiente'}
          icon={RefreshCw}
          variant="highlight"
          tooltip="Calculado sobre contratos expirados/concluídos no período que foram renovados em até 30 dias."
        />
      </div>

      {/* Relação Receita x Consumo (Planos Ilimitados) */}
      {curr.ilimitados_summary && (
        <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Planos Ilimitados — Relação Receita x Consumo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="text-xs text-slate-500 dark:text-slate-400">Valor Recebido do Plano</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(curr.ilimitados_summary.valor_recebido)}</div>
            </div>
            <div className="p-4 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="text-xs text-slate-500 dark:text-slate-400">Produção Comercial Consumida</div>
              <div className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(curr.ilimitados_summary.producao_consumida)}</div>
            </div>
            <div className="p-4 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="text-xs text-slate-500 dark:text-slate-400">Relação Receita x Consumo</div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">{formatCurrency(curr.ilimitados_summary.relacao_receita_consumo)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Pacotes de Crédito — Taxa de Utilização */}
      {curr.creditos_summary && (
        <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Pacotes de Crédito — Utilização de Saldo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="text-xs text-slate-500 dark:text-slate-400">Créditos Contratados</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">{curr.creditos_summary.creditos_contratados}</div>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="text-xs text-slate-500 dark:text-slate-400">Créditos Utilizados</div>
              <div className="text-lg font-bold text-amber-400 mt-1">{curr.creditos_summary.creditos_utilizados}</div>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="text-xs text-slate-500 dark:text-slate-400">Créditos Restantes</div>
              <div className="text-lg font-bold text-indigo-400 mt-1">{curr.creditos_summary.creditos_restantes}</div>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="text-xs text-slate-500 dark:text-slate-400">Taxa de Utilização</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">{curr.creditos_summary.taxa_utilizacao}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Ranking por Produto Comercial */}
      <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">Ranking de Pacotes e Planos Vendidos</h3>

        {(curr.ranking_produtos || []).length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">Nenhum pacote vendido no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                  <th className="py-2.5 px-3">Produto</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3 text-center">Qtd Vendida</th>
                  <th className="py-2.5 px-3 text-right">Receita Recebida</th>
                  <th className="py-2.5 px-3 text-center">Clientes Ativos</th>
                  <th className="py-2.5 px-3 text-center">Renovações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(curr.ranking_produtos || []).map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{p.package_name}</td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-medium">{p.package_type}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-amber-400">{p.quantidade_vendida}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400">{formatCurrency(p.receita_recebida)}</td>
                    <td className="py-2.5 px-3 text-center text-slate-200">{p.clientes_ativos}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-indigo-400">{p.renovacoes_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Planos Próximos do Vencimento */}
      <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Contratos Próximos do Vencimento (Próximos 30 Dias)</h3>
        </div>

        {(curr.planos_vencendo || []).length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">Nenhum contrato ativo expirando nos próximos 30 dias.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Plano</th>
                  <th className="py-2.5 px-3">Data de Expiração</th>
                  <th className="py-2.5 px-3 text-center">Dias Restantes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(curr.planos_vencendo || []).map((item: any) => (
                  <tr key={item.contract_id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{item.client_name}</td>
                    <td className="py-2.5 px-3 text-amber-400 font-medium">{item.package_name}</td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{formatDateBR(item.expires_at)}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-amber-400">{item.dias_para_vencer} dias</td>
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
