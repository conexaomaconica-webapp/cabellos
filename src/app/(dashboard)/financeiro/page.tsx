import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FinancialTransaction, CashRegister } from '@/types/database';
import { Wallet, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, Clock, Plus, Receipt, Landmark, PieChart, ShieldAlert } from 'lucide-react';
import { ManualTransactionModal } from './manual-transaction-modal';

export default async function FinancialDashboardPage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    return <div className="p-6 text-red-600 font-medium">Selecione uma organização no menu superior.</div>;
  }

  // Datas para o mês corrente
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const [
    { data: activeCashRegister },
    { data: rawTransactions },
    { data: rawReceivables },
    { data: rawPayables },
    { data: rawServices },
    { data: rawPaymentMethods },
    { data: rawCategories },
  ] = await Promise.all([
    supabase
      .from('cash_registers')
      .select('*')
      .eq('organization_id', activeOrgId)
      .eq('status', 'open')
      .maybeSingle(),
    supabase
      .from('financial_transactions')
      .select('*, category:financial_categories(*), payment_method:payment_methods(*)')
      .eq('organization_id', activeOrgId)
      .gte('transaction_date', startOfMonth)
      .lte('transaction_date', endOfMonth)
      .is('voided_at', null)
      .order('transaction_date', { ascending: false }),
    supabase
      .from('accounts_receivable')
      .select('remaining_amount, status')
      .eq('organization_id', activeOrgId)
      .in('status', ['pending', 'partial']),
    supabase
      .from('accounts_payable')
      .select('remaining_amount, status')
      .eq('organization_id', activeOrgId)
      .in('status', ['pending', 'partial']),
    supabase
      .from('appointment_services')
      .select('total, created_at, appointment:appointments(status)')
      .eq('organization_id', activeOrgId)
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth),
    supabase
      .from('payment_methods')
      .select('*')
      .eq('organization_id', activeOrgId)
      .eq('is_active', true),
    supabase
      .from('financial_categories')
      .select('*')
      .eq('organization_id', activeOrgId)
      .eq('is_active', true),
  ]);

  const cashRegister: CashRegister | null = activeCashRegister as any;
  const transactions: FinancialTransaction[] = (rawTransactions || []) as any;
  const paymentMethods = rawPaymentMethods || [];
  const categories = rawCategories || [];

  // 1. Produção Operacional (Valor comercial dos serviços prestados no mês)
  const productionTotal = (rawServices || [])
    .filter((s: any) => s.appointment?.status === 'completed')
    .reduce((acc: number, s: any) => acc + Number(s.total || 0), 0);

  // 2. Recebimentos Reais de Caixa (Entradas no mês)
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  // 3. Despesas Pagas no Mês
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  // 4. Contas a Receber Pendentes
  const totalReceivablePending = (rawReceivables || []).reduce((acc, r) => acc + Number(r.remaining_amount || 0), 0);

  // 5. Contas a Pagar Pendentes
  const totalPayablePending = (rawPayables || []).reduce((acc, p) => acc + Number(p.remaining_amount || 0), 0);

  // 6. Resultado de Caixa
  const cashResult = totalIncome - totalExpense;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-amber-400" /> Gestão Financeira & Resultados
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Acompanhe Produção Operacional, Recebimentos de Caixa, Contas a Receber e Despesas com controle rigoroso.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ManualTransactionModal paymentMethods={paymentMethods} categories={categories} />
          <Link href="/financeiro/caixa">
            <Button className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold gap-2 shadow-lg shadow-amber-600/20">
              <Landmark className="w-4 h-4" />
              {cashRegister ? 'Caixa Aberto (Ver Gaveta)' : 'Abrir Caixa Diário'}
            </Button>
          </Link>
        </div>
      </div>

      {/* Alerta de Caixa Físico */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg border ${cashRegister ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-100">
              Caixa Físico da Organização: {cashRegister ? 'ABERTO' : 'FECHADO'}
            </p>
            <p className="text-xs text-slate-400">
              {cashRegister
                ? `Aberto em ${new Date(cashRegister.opened_at).toLocaleTimeString('pt-BR')} com R$ ${Number(cashRegister.opening_balance).toFixed(2)}`
                : 'Abra o caixa diário para liberar recebimentos e despesas em dinheiro físico (espécie).'}
            </p>
          </div>
        </div>

        <Link href="/financeiro/caixa">
          <Badge variant="outline" className={cashRegister ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' : 'border-amber-500/40 text-amber-400 bg-amber-500/10'}>
            {cashRegister ? 'Gerenciar Caixa →' : 'Abrir Caixa →'}
          </Badge>
        </Link>
      </div>

      {/* Sub-Navegação Financeira */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/financeiro/caixa" className="p-3.5 bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 rounded-xl text-center transition-all">
          <Landmark className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <span className="text-xs font-semibold text-slate-200">Caixa Diário</span>
        </Link>
        <Link href="/financeiro/contas-receber" className="p-3.5 bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 rounded-xl text-center transition-all">
          <ArrowUpRight className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <span className="text-xs font-semibold text-slate-200">Contas a Receber</span>
        </Link>
        <Link href="/financeiro/despesas" className="p-3.5 bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 rounded-xl text-center transition-all">
          <ArrowDownRight className="w-5 h-5 text-rose-400 mx-auto mb-1" />
          <span className="text-xs font-semibold text-slate-200">Contas a Pagar</span>
        </Link>
        <Link href="/financeiro/comissoes" className="p-3.5 bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 rounded-xl text-center transition-all">
          <PieChart className="w-5 h-5 text-sky-400 mx-auto mb-1" />
          <span className="text-xs font-semibold text-slate-200">Comissões</span>
        </Link>
      </div>

      {/* Cards Principais dos 4 Pilares */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Produção Operacional */}
        <Card className="p-5 bg-slate-900/60 border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Produção Operacional</span>
            <Badge variant="outline" className="border-sky-500/30 text-sky-400 bg-sky-500/10 text-[10px]">
              Serviços Prestados
            </Badge>
          </div>
          <h3 className="text-2xl font-bold text-sky-400">R$ {productionTotal.toFixed(2)}</h3>
          <p className="text-[11px] text-slate-500">Valor comercial dos serviços concluídos no mês (inclui pacotes).</p>
        </Card>

        {/* 2. Recebimentos Efetivos no Caixa */}
        <Card className="p-5 bg-slate-900/60 border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recebimentos (Entradas)</span>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px]">
              Caixa Efetivo
            </Badge>
          </div>
          <h3 className="text-2xl font-bold text-emerald-400">R$ {totalIncome.toFixed(2)}</h3>
          <p className="text-[11px] text-slate-500">Dinheiro real recebido de atendimentos, vendas de planos e receitas.</p>
        </Card>

        {/* 3. Contas a Receber Pendentes */}
        <Card className="p-5 bg-slate-900/60 border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">A Receber Pendente</span>
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10 text-[10px]">
              Saldos Clientes
            </Badge>
          </div>
          <h3 className="text-2xl font-bold text-amber-400">R$ {totalReceivablePending.toFixed(2)}</h3>
          <p className="text-[11px] text-slate-500">Saldos pendentes de clientes a receber.</p>
        </Card>

        {/* 4. Despesas Pagas no Mês */}
        <Card className="p-5 bg-slate-900/60 border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Despesas Pagas</span>
            <Badge variant="outline" className="border-rose-500/30 text-rose-400 bg-rose-500/10 text-[10px]">
              Saídas Reais
            </Badge>
          </div>
          <h3 className="text-2xl font-bold text-rose-400">R$ {totalExpense.toFixed(2)}</h3>
          <p className="text-[11px] text-slate-500">Saídas pagas no mês. A Pagar: R$ {totalPayablePending.toFixed(2)}</p>
        </Card>
      </div>

      {/* Card do Resultado de Caixa */}
      <Card className="p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1 text-center md:text-left">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Resultado Gerencial de Caixa do Mês</span>
          <h2 className={`text-3xl font-extrabold ${cashResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            R$ {cashResult.toFixed(2)}
          </h2>
          <p className="text-xs text-slate-400">
            Calculado por: <span className="text-emerald-400 font-semibold">Recebimentos (R$ {totalIncome.toFixed(2)})</span> - <span className="text-rose-400 font-semibold">Despesas Pagas (R$ {totalExpense.toFixed(2)})</span>.
          </p>
        </div>

        <div className="flex gap-4">
          <div className="text-center p-3 bg-slate-950/80 rounded-xl border border-slate-800 min-w-[120px]">
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Contas a Receber</p>
            <p className="text-lg font-bold text-amber-400">R$ {totalReceivablePending.toFixed(2)}</p>
          </div>
          <div className="text-center p-3 bg-slate-950/80 rounded-xl border border-slate-800 min-w-[120px]">
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Contas a Pagar</p>
            <p className="text-lg font-bold text-rose-400">R$ {totalPayablePending.toFixed(2)}</p>
          </div>
        </div>
      </Card>

      {/* Tabela de Transações Recentes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-200">Últimas Transações Financeiras (Mês Corrente)</h2>
          <span className="text-xs text-slate-500">{transactions.length} transação(ões) auditada(s)</span>
        </div>

        {transactions.length === 0 ? (
          <Card className="p-8 text-center bg-slate-900/40 border-slate-800 text-slate-500 italic">
            Nenhuma transação financeira registrada este mês.
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Data</th>
                  <th className="p-3.5">Tipo</th>
                  <th className="p-3.5">Descrição</th>
                  <th className="p-3.5">Categoria</th>
                  <th className="p-3.5">Forma Pagto</th>
                  <th className="p-3.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transactions.slice(0, 15).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30">
                    <td className="p-3.5 font-medium">{new Date(t.transaction_date).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3.5">
                      <Badge variant="outline" className={t.type === 'income' ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' : 'border-rose-500/40 text-rose-400 bg-rose-500/10'}>
                        {t.type === 'income' ? 'Entrada' : 'Saída'}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-slate-200">{t.description}</td>
                    <td className="p-3.5 text-slate-400">{t.category?.name || '-'}</td>
                    <td className="p-3.5 text-slate-400">{t.payment_method?.name || '-'}</td>
                    <td className={`p-3.5 text-right font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.type === 'income' ? '+' : '-'} R$ {Number(t.amount).toFixed(2)}
                    </td>
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
