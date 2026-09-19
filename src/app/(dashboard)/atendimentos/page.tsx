import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { Appointment } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Calendar, Plus, Eye, User, UserCheck, Clock, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

interface AppointmentsPageProps {
  searchParams: Promise<{ period?: string; status?: string }>;
}

export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  const { period, status } = await searchParams;
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  let query = supabase
    .from('appointments')
    .select('*, client:clients(*), professional:professionals(*), services:appointment_services(*, service:services(*)), payments:appointment_payments(*, payment_method:payment_methods(*))')
    .eq('organization_id', activeOrgId!)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  // Obter Timezone do Tenant para filtros de data
  const { data: orgData } = await supabase.from('organizations').select('timezone').eq('id', activeOrgId!).single();
  const tz = orgData?.timezone || 'America/Sao_Paulo';

  const todayStr = new Date().toISOString().split('T')[0];

  if (period === 'today') {
    query = query.eq('appointment_date', todayStr);
  } else if (period === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    query = query.eq('appointment_date', yesterday.toISOString().split('T')[0]);
  }

  const { data: appointmentsData } = await query;
  const appointments = (appointmentsData || []) as Appointment[];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-amber-400" /> Atendimentos
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Histórico completo de atendimentos registrados no seu estabelecimento
          </p>
        </div>
        <Link href="/atendimentos/novo">
          <Button variant="default" className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold shadow-lg w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-1.5" /> Novo Atendimento
          </Button>
        </Link>
      </div>

      {/* Filters Bar */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4">
        <form method="GET" className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            <Link
              href="/atendimentos"
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                !period ? 'bg-amber-500/10 text-amber-500 font-bold border border-amber-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Todos
            </Link>
            <Link
              href="/atendimentos?period=today"
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                period === 'today' ? 'bg-amber-500/10 text-amber-500 font-bold border border-amber-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Hoje
            </Link>
            <Link
              href="/atendimentos?period=yesterday"
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                period === 'yesterday' ? 'bg-amber-500/10 text-amber-500 font-bold border border-amber-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Ontem
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <select
              name="status"
              defaultValue={status || ''}
              className="h-10 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Todos os Status</option>
              <option value="completed">Concluídos</option>
              <option value="cancelled">Cancelados</option>
              <option value="draft">Rascunhos</option>
            </select>
            <Button type="submit" variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700">
              Filtrar
            </Button>
          </div>
        </form>
      </Card>

      {/* List */}
      {appointments.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Nenhum atendimento encontrado"
          description="Você ainda não registrou atendimentos para os filtros selecionados."
          actionLabel="Registrar Novo Atendimento"
          actionHref="/atendimentos/novo"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {appointments.map((app) => {
            const clientName = app.client?.name || 'Cliente';
            const profName = app.professional?.name || 'Vários';
            const servicesList = app.services?.map((s) => s.service?.name).filter(Boolean).join(', ') || 'Serviço';

            return (
              <Card
                key={app.id}
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-300 dark:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {formatDate(app.finished_at || app.created_at)}
                        </span>
                        <Badge
                          variant={
                            app.status === 'completed'
                              ? 'success'
                              : app.status === 'cancelled'
                              ? 'destructive'
                              : 'outline'
                          }
                        >
                          {app.status === 'completed'
                            ? 'Concluído'
                            : app.status === 'cancelled'
                            ? 'Cancelado'
                            : app.status}
                        </Badge>
                      </div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white truncate max-w-[200px]">
                        {clientName}
                      </h3>
                    </div>

                    <Link href={`/atendimentos/${app.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-50 dark:bg-slate-800">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>

                  <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Serviço(s)</span>
                      <span className="text-slate-200 font-medium truncate max-w-[140px]">
                        {servicesList}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">Profissional</span>
                      <span className="text-slate-200 font-medium truncate max-w-[140px]">
                        {profName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400">Valor Total</span>
                      <span className="text-amber-400 font-bold text-sm">
                        {formatCurrency(app.total)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
