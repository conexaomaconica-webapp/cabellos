import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, ClientPackage } from '@/types/database';
import { PackageToggleSwitch } from './package-toggle-switch';
import { PackageCheck, Plus, Sparkles, Clock, Tag, Users, CheckCircle2, AlertTriangle } from 'lucide-react';

export default async function PackagesPage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    return <div className="p-6 text-red-600 font-medium">Selecione uma organização no menu superior.</div>;
  }

  // Buscar Pacotes Comerciais
  const { data: rawPackages } = await supabase
    .from('packages')
    .select(`
      *,
      items:package_items (
        id, service_id,
        service:services (id, name, price)
      ),
      rules:package_rules (
        id, rule_type, service_id, limit_quantity, period_type, period_quantity, is_unlimited,
        service:services (id, name)
      )
    `)
    .eq('organization_id', activeOrgId)
    .order('created_at', { ascending: false });

  const packages: Package[] = (rawPackages || []) as any;

  // Buscar Pacotes Vendidos a Clientes (visão de resumo)
  const { data: rawClientPackages } = await supabase
    .from('client_packages')
    .select(`
      *,
      client:clients (id, name, whatsapp, phone),
      package:packages (id, name)
    `)
    .eq('organization_id', activeOrgId)
    .order('created_at', { ascending: false })
    .limit(20);

  const clientPackages: ClientPackage[] = (rawClientPackages || []) as any;

  // Métricas rápidas
  const totalPackages = packages.length;
  const activePackages = packages.filter((p) => p.is_active).length;
  const activeClientPackages = clientPackages.filter((cp) => cp.status === 'active').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Pacotes e Planos de Atendimento</h1>
            <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10">
              ...
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gerencie opções de créditos fixos, assinaturas ilimitadas e planos recorrentes para seus clientes.
          </p>
        </div>

        <Link href="/pacotes/novo">
          <Button className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold gap-2 shadow-lg shadow-amber-600/20">
            <Plus className="w-4 h-4" />
            Novo Pacote ou Plano
          </Button>
        </Link>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Modelos Criados</p>

            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalPackages}</h3>
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Planos Ativos</p>
            <h3 className="text-2xl font-bold text-emerald-400">{activePackages}</h3>
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400 border border-sky-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Contratos Ativos no Mês</p>
            <h3 className="text-2xl font-bold text-sky-400">{activeClientPackages}</h3>
          </div>
        </Card>
      </div>

      {/* Catálogo Comercial */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-200">Catálogo Comercial</h2>

        {packages.length === 0 ? (
          <Card className="p-12 text-center bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-500">
              <PackageCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-slate-900 dark:text-slate-200 font-medium text-lg">Nenhum pacote ou plano cadastrado</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Crie opções de créditos ou planos ilimitados para fidelizar seus clientes.</p>
            </div>
            <Link href="/pacotes/novo">
              <Button className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold gap-2">
                <Plus className="w-4 h-4" />
                Criar Primeiro Pacote
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <Card
                key={pkg.id}
                className={`p-5 flex flex-col justify-between transition-all border ${pkg.is_active ? 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-amber-500/40' : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-900 opacity-60'
                  }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">{pkg.name}</h3>
                      {pkg.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{pkg.description}</p>}
                    </div>

                    <PackageToggleSwitch packageId={pkg.id} isActive={pkg.is_active} />
                  </div>

                  {/* Preço e Tipo */}
                  <div className="flex items-baseline justify-between border-y border-slate-200 dark:border-slate-800/60 py-3">
                    <div>
                      <span className="text-2xl font-extrabold text-amber-400">R$ {Number(pkg.price).toFixed(2)}</span>
                      <span className="text-xs text-slate-500 ml-1">/ {pkg.billing_type === 'monthly' ? 'mês' : pkg.billing_type === 'yearly' ? 'ano' : 'único'}</span>
                    </div>

                    <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 text-xs">
                      {pkg.package_type === 'credits'
                        ? 'Créditos'
                        : pkg.package_type === 'subscription'
                          ? 'Assinatura'
                          : pkg.package_type === 'limited_period'
                            ? 'Limite Periódico'
                            : 'Ilimitado'}
                    </Badge>
                  </div>

                  {/* Validade */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Validade de {pkg.validity_value} {pkg.validity_type === 'months' ? 'mês(es)' : pkg.validity_type === 'years' ? 'ano(s)' : 'dias'}</span>
                  </div>

                  {/* Serviços e Regras */}
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Regras & Serviços</p>
                    <div className="space-y-1.5">
                      {pkg.rules && pkg.rules.length > 0 ? (
                        pkg.rules.map((rule) => (
                          <div key={rule.id} className="text-xs bg-slate-100 dark:bg-slate-800/50 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>{rule.service?.name || 'Todos os serviços'}</span>
                            <span className="font-semibold text-amber-400">
                              {rule.rule_type === 'service_credit'
                                ? `${rule.limit_quantity}x`
                                : rule.rule_type === 'period_limit'
                                  ? `${rule.limit_quantity}x / ${rule.period_type === 'week' ? 'sem' : 'mês'}`
                                  : rule.rule_type === 'unlimited_service'
                                    ? 'Ilimitado'
                                    : `${rule.limit_quantity} visitas/mês`}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 italic">Nenhuma regra detalhada especificada.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{(pkg.items || []).length} serviço(s) incluído(s)</span>
                  <Link href={`/pacotes/${pkg.id}`} className="text-amber-400 hover:text-amber-300 font-medium">
                    Editar Detalhes →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recentes Vendas a Clientes */}
      {clientPackages.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-200">Últimos Pacotes/Planos Vendidos</h2>

          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-white dark:bg-slate-900/80 text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Cliente</th>
                  <th className="p-3.5">Pacote / Plano</th>
                  <th className="p-3.5">Vigência</th>
                  <th className="p-3.5">Valor Pago</th>
                  <th className="p-3.5">Status Venda</th>
                  <th className="p-3.5">Status Contrato</th>
                  <th className="p-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {clientPackages.map((cp) => (
                  <tr key={cp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="p-3.5 font-medium text-slate-900 dark:text-slate-100">{cp.client?.name || 'Cliente'}</td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">{cp.package?.name || 'Pacote'}</td>
                    <td className="p-3.5 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(cp.starts_at).toLocaleDateString('pt-BR')} até {new Date(cp.expires_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-3.5 font-semibold text-amber-400">R$ {Number(cp.amount_paid).toFixed(2)}</td>
                    <td className="p-3.5">
                      <Badge variant="outline" className={cp.payment_status === 'paid' ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' : 'border-amber-500/40 text-amber-400 bg-amber-500/10'}>
                        {cp.payment_status === 'paid' ? 'Pago' : cp.payment_status === 'partial' ? 'Parcial' : 'Pendente'}
                      </Badge>
                    </td>
                    <td className="p-3.5">
                      <Badge
                        variant="outline"
                        className={
                          cp.status === 'active'
                            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                            : cp.status === 'completed'
                              ? 'border-blue-500/40 text-blue-400 bg-blue-500/10'
                              : cp.status === 'expired'
                                ? 'border-rose-500/40 text-rose-400 bg-rose-500/10'
                                : 'border-slate-300 dark:border-slate-700 text-slate-500'
                        }
                      >
                        {cp.status === 'active' ? 'Ativo' : cp.status === 'completed' ? 'Concluído' : cp.status === 'expired' ? 'Vencido' : 'Cancelado'}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right">
                      <Link href={`/clientes/${cp.client_id}/pacotes/${cp.id}`} className="text-xs text-amber-400 hover:text-amber-300 font-medium">
                        Ver Contrato
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
