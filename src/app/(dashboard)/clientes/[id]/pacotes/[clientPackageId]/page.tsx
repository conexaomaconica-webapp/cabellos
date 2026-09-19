import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClientPackageActionButtons } from './client-package-action-buttons';
import { Clock, Calendar, CheckCircle2, AlertTriangle, PackageCheck, DollarSign, History, RefreshCw } from 'lucide-react';

interface PageProps {
  params: Promise<{
    id: string;
    clientPackageId: string;
  }>;
}

export default async function ClientPackageDetailsPage({ params }: PageProps) {
  const { id: clientId, clientPackageId } = await params;

  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    return <div className="p-6 text-red-600 font-medium">Selecione uma organização no menu superior.</div>;
  }

  // Buscar Pacote do Cliente com snapshots e histórico
  const { data: rawClientPkg } = await supabase
    .from('client_packages')
    .select(`
      *,
      client:clients (id, name, whatsapp, phone),
      package:packages (id, name, description),
      items:client_package_items (
        id, service_id, contracted_quantity, used_quantity, remaining_quantity,
        service:services (id, name, price)
      ),
      rules:client_package_rules (
        id, rule_type, service_id, limit_quantity, period_type, period_quantity, is_unlimited,
        service:services (id, name)
      ),
      usages:package_usages (
        id, quantity, used_at, voided_at,
        service:services (id, name),
        professional:professionals (id, name),
        appointment:appointments (id, appointment_date)
      ),
      payments:client_package_payments (
        id, amount, installments, paid_at, voided_at,
        payment_method:payment_methods (id, name)
      )
    `)
    .eq('id', clientPackageId)
    .eq('organization_id', activeOrgId)
    .single();

  if (!rawClientPkg) {
    return (
      <div className="p-6 text-slate-400">
        Pacote do cliente não encontrado.{' '}
        <Link href={`/clientes/${clientId}`} className="text-amber-400 underline">
          Voltar para ficha do cliente
        </Link>
      </div>
    );
  }

  const cp = rawClientPkg;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">{cp.package?.name || 'Contrato de Pacote/Plano'}</h1>
            <Badge
              variant="outline"
              className={
                cp.status === 'active'
                  ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                  : cp.status === 'completed'
                  ? 'border-blue-500/40 text-blue-400 bg-blue-500/10'
                  : cp.status === 'expired'
                  ? 'border-rose-500/40 text-rose-400 bg-rose-500/10'
                  : 'border-slate-700 text-slate-500'
              }
            >
              {cp.status === 'active' ? 'Ativo' : cp.status === 'completed' ? 'Concluído' : cp.status === 'expired' ? 'Vencido' : 'Cancelado'}
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Cliente: <span className="text-slate-200 font-semibold">{cp.client?.name}</span> • Venda realizada em {new Date(cp.purchased_at).toLocaleDateString('pt-BR')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/clientes/${clientId}`} className="text-xs text-slate-400 hover:text-slate-200 border border-slate-800 px-3 py-1.5 rounded-lg">
            ← Ficha do Cliente
          </Link>
          <ClientPackageActionButtons clientPackageId={cp.id} clientId={cp.client_id} status={cp.status} />
        </div>
      </div>

      {/* Cards Financeiro e Vigência */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 bg-slate-900/60 border-slate-800 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Valor do Contrato</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-amber-400">R$ {Number(cp.original_price - cp.discount).toFixed(2)}</span>
            {cp.discount > 0 && <span className="text-xs text-rose-400">Desc: R$ {Number(cp.discount).toFixed(2)}</span>}
          </div>
          <p className="text-xs text-slate-500">Valor Original: R$ {Number(cp.original_price).toFixed(2)}</p>
        </Card>

        <Card className="p-5 bg-slate-900/60 border-slate-800 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status Financeiro</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cp.payment_status === 'paid' ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' : 'border-amber-500/40 text-amber-400 bg-amber-500/10'}>
              {cp.payment_status === 'paid' ? 'Totalmente Pago' : cp.payment_status === 'partial' ? 'Pagamento Parcial' : 'Pagamento Pendente'}
            </Badge>
          </div>
          <p className="text-xs text-slate-400">Pago: R$ {Number(cp.amount_paid).toFixed(2)}</p>
        </Card>

        <Card className="p-5 bg-slate-900/60 border-slate-800 space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Período de Vigência</span>
          <div className="text-sm font-semibold text-slate-200">
            {new Date(cp.starts_at).toLocaleDateString('pt-BR')} até {new Date(cp.expires_at).toLocaleDateString('pt-BR')}
          </div>
          <p className="text-xs text-slate-500">
            {new Date(cp.expires_at) > new Date() ? `Vence em ${Math.ceil((new Date(cp.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} dias` : 'Vigência encerrada'}
          </p>
        </Card>
      </div>

      {/* Snapshot de Serviços e Regras Contratadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-slate-900/60 border-slate-800 space-y-4">
          <h2 className="text-base font-semibold text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-amber-400" /> Serviços Contratados (Snapshot)
          </h2>

          <div className="space-y-4">
            {(cp.items || []).map((item: any) => {
              const contracted = item.contracted_quantity;
              const used = item.used_quantity;
              const remaining = item.remaining_quantity;
              const percent = contracted ? Math.min(100, Math.round((used / contracted) * 100)) : 0;

              return (
                <div key={item.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-200">{item.service?.name}</span>
                    <span className="text-xs text-amber-400 font-bold">
                      {contracted !== null ? `${used} de ${contracted} utilizados (${remaining} restantes)` : 'Uso Ilimitado'}
                    </span>
                  </div>

                  {contracted !== null && (
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${percent}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6 bg-slate-900/60 border-slate-800 space-y-4">
          <h2 className="text-base font-semibold text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" /> Regras e Limites (Snapshot)
          </h2>

          <div className="space-y-3">
            {(cp.rules || []).map((rule: any) => (
              <div key={rule.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-300">
                <span>{rule.service?.name || 'Todos os serviços'}</span>
                <span className="font-semibold text-amber-400">
                  {rule.rule_type === 'service_credit'
                    ? `${rule.limit_quantity} créditos`
                    : rule.rule_type === 'period_limit'
                    ? `${rule.limit_quantity}x por ${rule.period_type === 'week' ? 'semana' : 'mês'}`
                    : rule.rule_type === 'unlimited_service'
                    ? 'Ilimitado'
                    : `${rule.limit_quantity} visitas/mês`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Histórico de Consumo (package_usages) */}
      <Card className="p-6 bg-slate-900/60 border-slate-800 space-y-4">
        <h2 className="text-base font-semibold text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
          <History className="w-5 h-5 text-amber-400" /> Histórico de Utilizações nos Atendimentos
        </h2>

        {(cp.usages || []).length === 0 ? (
          <p className="text-xs text-slate-500 py-4 italic">Nenhum consumo registrado até o momento.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase">
                <tr>
                  <th className="p-3">Data Uso</th>
                  <th className="p-3">Serviço</th>
                  <th className="p-3">Profissional</th>
                  <th className="p-3">Qtd</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(cp.usages || []).map((u: any) => (
                  <tr key={u.id} className={u.voided_at ? 'opacity-40 line-through' : ''}>
                    <td className="p-3 font-medium">{new Date(u.used_at).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3 text-slate-200">{u.service?.name}</td>
                    <td className="p-3 text-slate-400">{u.professional?.name || '-'}</td>
                    <td className="p-3 font-bold text-amber-400">{u.quantity}x</td>
                    <td className="p-3">
                      {u.voided_at ? (
                        <Badge variant="outline" className="border-rose-500/40 text-rose-400 bg-rose-500/10">
                          Cancelado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                          Efetuado
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
