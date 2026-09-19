import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AccountPayable, PaymentMethod, FinancialCategory } from '@/types/database';
import { AccountsPayableTable } from './accounts-payable-table';
import { ArrowDownRight } from 'lucide-react';

export default async function AccountsPayablePage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    return <div className="p-6 text-red-600 font-medium">Selecione uma organização no menu superior.</div>;
  }

  const [
    { data: rawPayables },
    { data: rawPaymentMethods },
    { data: rawCategories },
  ] = await Promise.all([
    supabase
      .from('accounts_payable')
      .select('*, category:financial_categories(*)')
      .eq('organization_id', activeOrgId)
      .order('due_date', { ascending: true }),
    supabase
      .from('payment_methods')
      .select('*')
      .eq('organization_id', activeOrgId)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('financial_categories')
      .select('*')
      .eq('organization_id', activeOrgId)
      .eq('type', 'expense')
      .eq('is_active', true),
  ]);

  const payables: AccountPayable[] = (rawPayables || []) as any;
  const paymentMethods: PaymentMethod[] = (rawPaymentMethods || []) as any;
  const categories: FinancialCategory[] = (rawCategories || []) as any;

  const totalRemaining = payables
    .filter((p) => ['pending', 'partial'].includes(p.status))
    .reduce((acc, p) => acc + Number(p.remaining_amount), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <ArrowDownRight className="w-7 h-7 text-rose-400" /> Contas a Pagar & Despesas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestão de despesas operacionais do estabelecimento (aluguel, fornecedores, utilidades e comissões).
          </p>
        </div>

        <Link href="/financeiro" className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-200 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg">
          ← Voltar para Financeiro
        </Link>
      </div>

      {/* Metric Card */}
      <Card className="p-5 bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Total Pendente a Pagar</p>
          <h2 className="text-3xl font-extrabold text-rose-400 mt-1">R$ {totalRemaining.toFixed(2)}</h2>
        </div>

        <Badge variant="outline" className="border-rose-500/40 text-rose-400 bg-rose-500/10">
          {payables.filter((p) => ['pending', 'partial'].includes(p.status)).length} despesa(s) pendente(s)
        </Badge>
      </Card>

      {/* Interactive Table Component */}
      <AccountsPayableTable payables={payables} paymentMethods={paymentMethods} categories={categories} />
    </div>
  );
}
