import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Commission } from '@/types/database';
import { CommissionsTable } from './commissions-table';
import { Award, ArrowLeft } from 'lucide-react';

export default async function CommissionsPage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    return <div className="p-6 text-red-600 font-medium">Selecione uma organização no menu superior.</div>;
  }

  const { data: rawCommissions } = await supabase
    .from('commissions')
    .select(`
      *,
      professional:professionals(name),
      commission_items(
        id,
        production_amount,
        commission_amount,
        appointment_service:appointment_services(
          appointment_id,
          service:services(name)
        )
      )
    `)
    .eq('organization_id', activeOrgId)
    .order('created_at', { ascending: false });

  const commissions: any[] = rawCommissions || [];

  const totalCalculated = commissions
    .filter((c) => c.status === 'calculated')
    .reduce((acc, c) => acc + Number(c.total_commission), 0);

  const totalApproved = commissions
    .filter((c) => c.status === 'approved')
    .reduce((acc, c) => acc + Number(c.total_commission), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Award className="w-7 h-7 text-amber-400" /> Comissões de Profissionais
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Apuração histórica de comissões por produção de serviço com snapshot de taxas e geração de contas a pagar.
          </p>
        </div>

        <Link
          href="/financeiro"
          className="text-xs text-slate-400 hover:text-slate-200 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-1 w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Financeiro
        </Link>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 bg-slate-900/80 border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Aguardando Aprovação</p>
            <h2 className="text-2xl font-extrabold text-amber-400 mt-1">R$ {totalCalculated.toFixed(2)}</h2>
          </div>
          <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10">
            {commissions.filter((c) => c.status === 'calculated').length} apuração(ões)
          </Badge>
        </Card>

        <Card className="p-5 bg-slate-900/80 border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Aprovadas (Em Contas a Pagar)</p>
            <h2 className="text-2xl font-extrabold text-sky-400 mt-1">R$ {totalApproved.toFixed(2)}</h2>
          </div>
          <Badge variant="outline" className="border-sky-500/40 text-sky-400 bg-sky-500/10">
            {commissions.filter((c) => c.status === 'approved').length} aprovada(s)
          </Badge>
        </Card>
      </div>

      {/* Table Component */}
      <CommissionsTable commissions={commissions} />
    </div>
  );
}
