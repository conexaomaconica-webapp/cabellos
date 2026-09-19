import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { Client } from '@/types/database';
import { formatPhoneNumber, formatDate, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Users, Plus, Search, Phone, MessageSquare, Edit3, UserCheck, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { ImportContactsModal } from '@/components/clients/ImportContactsModal';

interface ClientsPageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const { q, status } = await searchParams;
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  let query = supabase
    .from('clients')
    .select('*, preferred_professional:professionals(*), preferred_service:services(*)')
    .eq('organization_id', activeOrgId!)
    .order('created_at', { ascending: false });

  if (status === 'inactive') {
    query = query.eq('is_active', false);
  } else {
    query = query.eq('is_active', true);
  }

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,whatsapp.ilike.%${q}%`);
  }

  const { data: clientsData, error } = await query;
  const clients = (clientsData || []) as Client[];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-amber-400" /> Clientes
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Gerencie a base de clientes do seu estabelecimento
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ImportContactsModal />
          <Link href="/clientes/novo">
            <Button variant="default" className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold shadow-lg w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1.5" /> Novo Cliente
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        <form method="GET" className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              name="q"
              defaultValue={q || ''}
              placeholder="Buscar por nome, telefone ou WhatsApp..."
              className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              name="status"
              defaultValue={status || 'active'}
              className="h-11 px-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="active">Clientes Ativos</option>
              <option value="inactive">Inativos / Arquivados</option>
            </select>
            <Button type="submit" variant="secondary" className="bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700">
              Filtrar
            </Button>
          </div>
        </form>
      </Card>

      {/* Clients List */}
      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente encontrado"
          description={
            q
              ? `Nenhum resultado para "${q}". Tente buscar por outros termos.`
              : 'Você ainda não possui clientes cadastrados na organização.'
          }
          actionLabel="Cadastrar Primeiro Cliente"
          actionHref="/clientes/novo"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Card
              key={client.id}
              className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
            >
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="font-bold text-base text-white truncate max-w-[200px]">
                      {client.name}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={client.is_active ? 'success' : 'destructive'}>
                        {client.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {client.custom_return_interval_days && (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                          {client.custom_return_interval_days} dias
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Link href={`/clientes/${client.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                <div className="space-y-2 text-xs text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                  {client.whatsapp && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-400" /> WhatsApp
                      </span>
                      <span className="font-mono text-slate-200 font-medium">
                        {formatPhoneNumber(client.whatsapp)}
                      </span>
                    </div>
                  )}

                  {client.phone && !client.whatsapp && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Phone className="h-3.5 w-3.5 text-blue-400" /> Telefone
                      </span>
                      <span className="font-mono text-slate-200 font-medium">
                        {formatPhoneNumber(client.phone)}
                      </span>
                    </div>
                  )}

                  {client.preferred_professional && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <UserCheck className="h-3.5 w-3.5 text-amber-400" /> Profissional
                      </span>
                      <span className="text-slate-200 font-medium truncate max-w-[120px]">
                        {client.preferred_professional.name}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <span className="text-slate-400">Total Gasto</span>
                    <span className="text-amber-400 font-bold">
                      {formatCurrency(client.total_spent)}
                    </span>
                  </div>
                </div>

                {client.notes && (
                  <p className="text-xs text-slate-400 italic line-clamp-2">
                    &quot;{client.notes}&quot;
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
