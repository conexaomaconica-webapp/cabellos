import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CashRegister, CashMovement } from '@/types/database';
import { CashRegisterControl } from './cash-register-control';
import { Landmark, ArrowUpRight, ArrowDownRight, History, DollarSign } from 'lucide-react';

export default async function CashRegisterPage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    return <div className="p-6 text-red-600 font-medium">Selecione uma organização no menu superior.</div>;
  }

  // Buscar caixa aberto atualmente
  const { data: activeRegister } = await supabase
    .from('cash_registers')
    .select(`
      *,
      movements:cash_movements (*)
    `)
    .eq('organization_id', activeOrgId)
    .eq('status', 'open')
    .maybeSingle();

  // Buscar caixas anteriores fechados
  const { data: rawPastRegisters } = await supabase
    .from('cash_registers')
    .select('*')
    .eq('organization_id', activeOrgId)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(10);

  const pastRegisters: CashRegister[] = (rawPastRegisters || []) as any;
  const cashRegister: CashRegister | null = activeRegister as any;
  const movements: CashMovement[] = (activeRegister?.movements || []) as any;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Landmark className="w-7 h-7 text-amber-400" /> Fechamento e Caixa Diário
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Controle de abertura, suprimento, sangria, contagem de gaveta física e balanço de divergência.
          </p>
        </div>

        <Link href="/financeiro" className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-200 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg">
          ← Voltar para Financeiro
        </Link>
      </div>

      {/* Componente Interativo de Abertura / Suprimento / Sangria / Fechamento */}
      <CashRegisterControl cashRegister={cashRegister} movements={movements} />

      {/* Histórico de Caixas Fechados */}
      {pastRegisters.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-200">Histórico de Caixas Fechados</h2>

          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-white dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Abertura</th>
                  <th className="p-3.5">Fechamento</th>
                  <th className="p-3.5">Saldo Inicial</th>
                  <th className="p-3.5">Esperado em Espécie</th>
                  <th className="p-3.5">Contado (Real)</th>
                  <th className="p-3.5">Divergência</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pastRegisters.map((cr) => (
                  <tr key={cr.id} className="hover:bg-slate-800/30">
                    <td className="p-3.5 font-medium">{new Date(cr.opened_at).toLocaleDateString('pt-BR')} {new Date(cr.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-3.5 text-slate-500 dark:text-slate-400">{cr.closed_at ? `${new Date(cr.closed_at).toLocaleDateString('pt-BR')} ${new Date(cr.closed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '-'}</td>
                    <td className="p-3.5">R$ {Number(cr.opening_balance).toFixed(2)}</td>
                    <td className="p-3.5 text-amber-400 font-semibold">R$ {Number(cr.expected_balance || 0).toFixed(2)}</td>
                    <td className="p-3.5 font-bold text-slate-100">R$ {Number(cr.closing_balance || 0).toFixed(2)}</td>
                    <td className={`p-3.5 font-bold ${Number(cr.difference || 0) === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      R$ {Number(cr.difference || 0).toFixed(2)}
                    </td>
                    <td className="p-3.5">
                      <Badge variant="outline" className="border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-slate-800/40">
                        Fechado
                      </Badge>
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
