import { getClientRetentionReportAction } from '../actions';
import { KpiCard } from '@/components/reports/KpiCard';
import { ExportCsvButton } from '@/components/reports/ExportCsvButton';
import { formatCurrency, formatDateBR } from '@/lib/reports';
import { Users, UserPlus, Repeat, Clock, AlertTriangle, UserX } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}

export default async function ClientRetentionReportPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const period = resolvedParams.period || 'this_month';
  const start = resolvedParams.start;
  const end = resolvedParams.end;

  const data = await getClientRetentionReportAction(period, start, end);
  const curr = data.current || {};

  return (
    <div className="space-y-6">
      {/* Header com botão de Exportação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Análise de Clientes e Retenção</h2>
          <p className="text-xs text-slate-400">Recorrência da base, novos atendimentos e clientes em risco de inatividade.</p>
        </div>

        <div className="flex items-center gap-2">
          <ExportCsvButton reportType="clientes_inativos" label="CSV Inativos" />
          <ExportCsvButton reportType="clientes_atrasados" label="CSV Atrasados" />
        </div>
      </div>

      {/* Cards de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Novos Clientes"
          subtitle="Primeiro atendimento no período"
          value={curr.novos_clientes_count || 0}
          icon={UserPlus}
          variant="highlight"
          tooltip="Clientes cujo first_appointment_at ocorreu dentro do período selecionado."
        />

        <KpiCard
          title="Clientes Recorrentes"
          subtitle="Já atendidos anteriormente"
          value={curr.recorrentes_count || 0}
          icon={Repeat}
          variant="success"
          tooltip="Clientes atendidos no período que possuíam pelo menos um atendimento concluído prévio."
        />

        <KpiCard
          title="Taxa de Recorrência"
          subtitle="Recorrentes / Atendidos no período"
          value={curr.taxa_recorrencia !== null ? `${curr.taxa_recorrencia}%` : '—'}
          icon={Users}
          variant="default"
          tooltip="Calculado como (Clientes Recorrentes / Clientes Atendidos no Período) * 100."
        />

        <KpiCard
          title="Conversão de Retorno"
          subtitle="Central de Retornos"
          value={curr.conversao_retorno !== null ? `${curr.conversao_retorno}%` : '—'}
          icon={Clock}
          variant="highlight"
          tooltip="Alertas encerrados no período com status = returned / total de alertas encerrados."
        />
      </div>

      {/* Tabela de Clientes Inativos */}
      <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-amber-400" />
            <h3 className="font-bold text-white text-sm">Clientes Inativos</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Total na amostra: {(curr.clientes_inativos || []).length}
          </span>
        </div>

        {(curr.clientes_inativos || []).length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">Nenhum cliente inativo identificado nesta base.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase">
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Telefone</th>
                  <th className="py-2.5 px-3">Último Atendimento</th>
                  <th className="py-2.5 px-3 text-center">Dias Inativo</th>
                  <th className="py-2.5 px-3 text-right">Histórico Produzido</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(curr.clientes_inativos || []).slice(0, 15).map((client: any) => (
                  <tr key={client.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-white">{client.name}</td>
                    <td className="py-2.5 px-3 text-slate-400">{client.phone || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-300">{formatDateBR(client.last_appointment_at)}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-amber-400">{client.dias_inativo} dias</td>
                    <td className="py-2.5 px-3 text-right font-medium text-emerald-400">{formatCurrency(client.total_historico)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        href={`/clientes/${client.id}`}
                        className="text-amber-400 hover:underline text-[11px] font-semibold"
                      >
                        Ver Ficha
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabela de Clientes Atrasados */}
      <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
            <h3 className="font-bold text-white text-sm">Clientes Atrasados (Central de Retornos)</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Total vencidos: {(curr.clientes_atrasados || []).length}
          </span>
        </div>

        {(curr.clientes_atrasados || []).length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">Nenhum retorno atrasado pendente no momento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase">
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Serviço</th>
                  <th className="py-2.5 px-3">Profissional</th>
                  <th className="py-2.5 px-3">Prazo Vencido</th>
                  <th className="py-2.5 px-3 text-center">Atraso</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(curr.clientes_atrasados || []).slice(0, 15).map((item: any) => (
                  <tr key={item.alert_id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-white">{item.client_name}</td>
                    <td className="py-2.5 px-3 text-amber-400 font-medium">{item.service_name}</td>
                    <td className="py-2.5 px-3 text-slate-400">{item.professional_name || 'Qualquer'}</td>
                    <td className="py-2.5 px-3 text-slate-300">{formatDateBR(item.due_date)}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-rose-400">{item.dias_atraso} dias</td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        href={`/retornos`}
                        className="text-amber-400 hover:underline text-[11px] font-semibold"
                      >
                        Contato
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Frequência Média por Serviço */}
      <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
        <h3 className="font-bold text-white text-sm">Frequência Média de Retorno por Serviço</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(curr.frequencias_por_servico || []).map((freq: any, idx: number) => (
            <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
              <div className="text-xs font-semibold text-white">{freq.service_name}</div>
              <div className="text-lg font-extrabold text-amber-400">{freq.avg_frequency_days} dias</div>
              <div className="text-[11px] text-slate-500">{freq.clients_count} clientes calculados</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
