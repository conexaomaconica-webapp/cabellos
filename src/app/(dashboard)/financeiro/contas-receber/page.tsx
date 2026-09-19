import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AccountReceivable, PaymentMethod } from '@/types/database';
import { AccountsReceivableTable } from './accounts-receivable-table';
import { ArrowUpRight, DollarSign } from 'lucide-react';

export default async function AccountsReceivablePage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    return <div className="p-6 text-red-600 font-medium">Selecione uma organização no menu superior.</div>;
  }

  const [{ data: rawReceivables }, { data: rawPaymentMethods }] = await Promise.all([
    supabase
      .from('accounts_receivable')
      .select('*, client:clients(id, name, whatsapp, phone), appointment:appointments(id, appointment_date)')
      .eq('organization_id', activeOrgId)
      .order('due_date', { ascending: true }),
    supabase
      .from('payment_methods')
      .select('*')
      .eq('organization_id', activeOrgId)
      .eq('is_active', true)
      .order('sort_order'),
  ]);

  const receivables: AccountReceivable[] = (rawReceivables || []) as any;
  const paymentMethods: PaymentMethod[] = (rawPaymentMethods || []) as any;

  const totalRemaining = receivables
    .filter((r) => ['pending', 'partial'].includes(r.status))
    .reduce((acc, r) => acc + Number(r.remaining_amount), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <ArrowUpRight className="w-7 h-7 text-emerald-400" /> Contas a Receber
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestão de pendências financeiras de clientes decorrentes de atendimentos ou vendas de pacotes parceladas.
          </p>
        </div>

        <Link href="/financeiro" className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-200 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg">
          ← Voltar para Financeiro
        </Link>
      </div>

      {/* Metric Card */}
      <Card className="p-5 bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Total Pendente a Receber</p>
          <h2 className="text-3xl font-extrabold text-amber-400 mt-1">R$ {totalRemaining.toFixed(2)}</h2>
        </div>

        <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10">
          {receivables.filter((r) => ['pending', 'partial'].includes(r.status)).length} conta(s) pendente(s)
        </Badge>
      </Card>

      {/* Interactive Table Component */}
      <AccountsReceivableTable receivables={receivables} paymentMethods={paymentMethods} />
    </div>
  );
}
