import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { Professional } from '@/types/database';
import { formatPhoneNumber, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { UserCheck, Plus, Edit3, Phone, Mail, Percent, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default async function ProfessionalsPage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  const { data: professionalsData } = await supabase
    .from('professionals')
    .select('*, professional_services(service_id, services(*))')
    .eq('organization_id', activeOrgId!)
    .order('created_at', { ascending: false });

  const professionals = (professionalsData || []) as (Professional & {
    professional_services?: { service_id: string; services?: { name: string } }[];
  })[];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-emerald-400" /> Profissionais
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Cadastre os membros da equipe e os serviços prestados por cada um
          </p>
        </div>
        <Link href="/cadastros/profissionais/novo">
          <Button variant="default" className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold shadow-lg w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-1.5" /> Novo Profissional
          </Button>
        </Link>
      </div>

      {/* List */}
      {professionals.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="Nenhum profissional cadastrado"
          description="Cadastre os cabeleireiros, barbeiros, manicures e especialistas do seu estabelecimento."
          actionLabel="Cadastrar Primeiro Profissional"
          actionHref="/cadastros/profissionais/novo"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {professionals.map((prof) => {
            const servicesList = prof.professional_services
              ?.map((ps) => ps.services?.name)
              .filter(Boolean);

            return (
              <Card
                key={prof.id}
                className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="font-bold text-base text-white truncate max-w-[200px]">
                        {prof.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant={prof.is_active ? 'success' : 'destructive'}>
                          {prof.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                        {prof.commission_type !== 'none' && (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
                            {prof.commission_type === 'percentage'
                              ? `${prof.commission_value}% Comiss.`
                              : `${formatCurrency(prof.commission_value)} Fixo`}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Link href={`/cadastros/profissionais/${prof.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                    {prof.phone && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Phone className="h-3.5 w-3.5 text-slate-400" /> Contato
                        </span>
                        <span className="font-mono text-slate-200">{formatPhoneNumber(prof.phone)}</span>
                      </div>
                    )}

                    {prof.email && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Mail className="h-3.5 w-3.5 text-slate-400" /> E-mail
                        </span>
                        <span className="text-slate-200 truncate max-w-[140px]">{prof.email}</span>
                      </div>
                    )}
                  </div>

                  {servicesList && servicesList.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Serviços Realizados
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {servicesList.map((s, idx) => (
                          <span
                            key={idx}
                            className="inline-block px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-medium"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
