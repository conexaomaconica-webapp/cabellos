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
                className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between shadow-xl relative overflow-visible group"
              >
                <CardContent className="p-6 space-y-4 flex flex-col items-center text-center">
                  {/* Botão de Editar no canto superior direito */}
                  <div className="absolute top-3 right-3 z-10">
                    <Link href={`/cadastros/profissionais/${prof.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>

                  {/* Foto Maior e Centralizada em Cima do Nome - Zoom 2x no Hover */}
                  <div className="relative mt-2">
                    {prof.photo_url ? (
                      <img
                        src={prof.photo_url}
                        alt={prof.name}
                        className="h-24 w-24 rounded-2xl object-cover border-2 border-emerald-500/40 bg-slate-950 shadow-xl ring-4 ring-emerald-500/10 hover:scale-[2] hover:z-50 relative transition-transform duration-300 ease-out cursor-pointer hover:shadow-2xl hover:ring-emerald-400"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-2xl shadow-xl ring-4 ring-emerald-500/10 hover:scale-[2] hover:z-50 relative transition-transform duration-300 ease-out cursor-pointer hover:shadow-2xl hover:ring-emerald-400">
                        {prof.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Nome e Badges de Status */}
                  <div className="space-y-1 w-full">
                    <h3 className="font-bold text-lg text-white truncate max-w-full">
                      {prof.name}
                    </h3>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
                      <Badge variant={prof.is_active ? 'success' : 'destructive'}>
                        {prof.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {prof.commission_type !== 'none' && (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs">
                          {prof.commission_type === 'percentage'
                            ? `${prof.commission_value}% Comiss.`
                            : `${formatCurrency(prof.commission_value)} Fixo`}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="w-full space-y-2 text-xs text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                    {prof.phone && (
                      <div className="flex items-center justify-between gap-2 min-w-0 w-full">
                        <span className="flex items-center gap-1.5 text-slate-400 shrink-0">
                          <Phone className="h-3.5 w-3.5 text-slate-400" /> Contato
                        </span>
                        <span className="font-mono text-slate-200 truncate">{formatPhoneNumber(prof.phone)}</span>
                      </div>
                    )}

                    {prof.email && (
                      <div className="flex items-center justify-between gap-2 min-w-0 w-full">
                        <span className="flex items-center gap-1.5 text-slate-400 shrink-0">
                          <Mail className="h-3.5 w-3.5 text-slate-400" /> E-mail
                        </span>
                        <span className="text-slate-200 truncate min-w-0 text-right font-medium" title={prof.email}>
                          {prof.email}
                        </span>
                      </div>
                    )}
                  </div>

                  {servicesList && servicesList.length > 0 && (
                    <div className="space-y-1 w-full">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Serviços Realizados
                      </p>
                      <div className="flex flex-wrap justify-center gap-1">
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
