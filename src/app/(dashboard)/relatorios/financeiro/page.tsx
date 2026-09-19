import { getFinancialReportAction } from '../actions';
import { KpiCard } from '@/components/reports/KpiCard';
import { SimpleLineChart, SimpleBarChart } from '@/components/reports/SimpleChart';
import { ExportCsvButton } from '@/components/reports/ExportCsvButton';
import { formatCurrency, formatDateBR } from '@/lib/reports';
import { Wallet, ShieldAlert, CreditCard, AlertOctagon, History, FileText } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}

export default async function FinancialReportPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const period = resolvedParams.period || 'this_month';
  const start = resolvedParams.start;
  const end = resolvedParams.end;

  let data;
  let errorMsg = null;

  try {
    data = await getFinancialReportAction(period, start, end);
  } catch (err: any) {
    errorMsg = err.message || 'Acesso não autorizado.';
  }

  if (errorMsg) {
    return (
      <div className="p-8 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-rose-400 mx-auto" />
        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Acesso Restrito ao Financeiro</h3>
        <p className="text-xs text-rose-300 max-w-md mx-auto">{errorMsg}</p>
      </div>
    );
  }

  const curr = data?.current || {};
  const aging = curr.aging_contas_receber || {};
  const contasPagar = curr.contas_pagar || {};

  return (
    <div className="space-y-6">
      {/* Header com botão de Exportação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">DRE Gerencial, Aging e Auditoria Financeira</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Análise de saúde financeira, vencimentos, meios de pagamento e histórico de auditoria.</p>
        </div>

        <ExportCsvButton reportType="auditoria" label="Exportar CSV Auditoria" />
      </div>

      {/* Cards de Carteira Vencida */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Saldo Aberto Contas a Receber"
          subtitle="Total pendente na carteira"
          value={formatCurrency(curr.saldo_total_aberto)}
          icon={Wallet}
        />

        <KpiCard
          title="Saldo Vencido a Receber"
          subtitle="Títulos que ultrapassaram due_date"
          value={formatCurrency(curr.saldo_vencido)}
          icon={AlertOctagon}
          variant="danger"
        />

        <KpiCard
          title="Percentual Carteira Vencida"
          subtitle="Saldo vencido / Saldo aberto"
          value={curr.carteira_vencida_pct !== null ? `${curr.carteira_vencida_pct}%` : 'Sem carteira em aberto'}
          icon={CreditCard}
          variant={curr.carteira_vencida_pct > 20 ? 'danger' : 'default'}
          tooltip="Se o saldo total em aberto for 0, exibe 'Sem carteira em aberto'."
        />

        <KpiCard
          title="Comissões a Pagar"
          subtitle="Calculadas e Aprovadas"
          value={formatCurrency(curr.comissoes_a_pagar)}
          icon={FileText}
          variant="warning"
        />
      </div>

      {/* Aging de Contas a Receber (6 Faixas) */}
      <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">Aging de Contas a Receber (Faixas de Vencimento)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="text-[11px] text-emerald-400 font-semibold">A Vencer</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(aging.a_vencer)}</div>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="text-[11px] text-amber-400 font-semibold">1–7 dias vencido</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(aging.dias_1_7)}</div>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="text-[11px] text-amber-500 font-semibold">8–15 dias</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(aging.dias_8_15)}</div>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="text-[11px] text-rose-400 font-semibold">16–30 dias</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(aging.dias_16_30)}</div>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="text-[11px] text-rose-500 font-semibold">31–60 dias</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(aging.dias_31_60)}</div>
          </div>
          <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="text-[11px] text-rose-600 font-bold">60+ dias</div>
            <div className="text-base font-extrabold text-rose-400 mt-1">{formatCurrency(aging.dias_60_mais)}</div>
          </div>
        </div>
      </div>

      {/* Gráfico de Séries Temporais */}
      {curr.series_temporais && (
        <SimpleLineChart
          title="Resultado de Caixa e Fluxo Temporal"
          data={(curr.series_temporais || []).map((s: any) => ({
            date: s.data_periodo,
            producao: Number(s.producao || 0),
            recebimentos: Number(s.recebimentos || 0),
            despesas: Number(s.despesas || 0),
            resultado_caixa: Number(s.resultado_caixa || 0),
          }))}
        />
      )}

      {/* Recebimentos por Meio de Pagamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SimpleBarChart
          title="Recebimentos por Meio de Pagamento (R$)"
          data={(curr.meios_pagamento || []).map((m: any) => ({
            label: m.meio_pagamento,
            value: Number(m.valor_total || 0),
          }))}
        />

        {/* Contas a Pagar (Prazos) */}
        <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Contas a Pagar (Prazos)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="text-xs text-rose-400 font-semibold">Vencido</div>
              <div className="text-lg font-bold text-rose-400 mt-1">{formatCurrency(contasPagar.vencido)}</div>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="text-xs text-amber-400 font-semibold">Hoje</div>
              <div className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(contasPagar.hoje)}</div>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">Próximos 7 dias</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(contasPagar.proximos_7_dias)}</div>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">Próximos 30 dias</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(contasPagar.proximos_30_dias)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Divergências de Caixa */}
      <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">Divergências no Fechamento de Caixa</h3>

        {(curr.divergencias_caixa || []).length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">Nenhuma divergência de caixa registrada no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                  <th className="py-2.5 px-3">Data Encerramento</th>
                  <th className="py-2.5 px-3">Responsável</th>
                  <th className="py-2.5 px-3 text-right">Saldo Esperado</th>
                  <th className="py-2.5 px-3 text-right">Saldo Informado</th>
                  <th className="py-2.5 px-3 text-right">Diferença</th>
                  <th className="py-2.5 px-3">Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(curr.divergencias_caixa || []).map((div: any) => (
                  <tr key={div.cash_register_id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{formatDateBR(div.closed_at)}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{div.responsavel_nome}</td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency(div.expected_balance)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency(div.actual_balance)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-400">{formatCurrency(div.difference_amount)}</td>
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{div.closure_notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Auditoria de Transações Válidas e Anuladas */}
      <div className="p-5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-amber-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Auditoria de Transações Financeiras</h3>
        </div>

        {(curr.auditoria_transacoes || []).length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">Nenhuma transação registrada no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3 text-right">Valor</th>
                  <th className="py-2.5 px-3">Descrição / Origem</th>
                  <th className="py-2.5 px-3">Criado por</th>
                  <th className="py-2.5 px-3">Status / Anulação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(curr.auditoria_transacoes || []).map((tx: any) => {
                  const isVoided = !!tx.voided_at;
                  return (
                    <tr key={tx.transaction_id} className={`hover:bg-slate-800/40 ${isVoided ? 'opacity-60 bg-rose-500/5' : ''}`}>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{formatDateBR(tx.created_at)}</td>
                      <td className="py-2.5 px-3 font-semibold uppercase text-slate-200">{tx.type}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                        {tx.description} {tx.source_type ? `(${tx.source_type})` : ''}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{tx.created_by_name || '—'}</td>
                      <td className="py-2.5 px-3">
                        {isVoided ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            ANULADA em {formatDateBR(tx.voided_at)} por {tx.voided_by_name || 'Usuário'} ({tx.void_reason || 'sem motivo'})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            VÁLIDA
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
