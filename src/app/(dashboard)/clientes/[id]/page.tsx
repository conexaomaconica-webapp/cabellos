import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { ClientForm } from '@/components/clients/ClientForm';
import { ClientServiceFrequencies } from '@/components/clients/ClientServiceFrequencies';
import { ClientPackagesSection } from '@/components/clients/ClientPackagesSection';
import { Client, Professional, Service, Appointment, ClientServiceFrequency, ClientContact, ClientPackage, Package, PaymentMethod } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface EditClientPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  const [
    { data: clientData },
    { data: professionalsData },
    { data: servicesData },
    { data: appointmentsData },
    { data: frequenciesData },
    { data: contactsData },
    { data: clientPackagesData },
    { data: availablePackagesData },
    { data: paymentMethodsData },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('organization_id', activeOrgId!)
      .single(),
    supabase
      .from('professionals')
      .select('*')
      .eq('organization_id', activeOrgId!)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('services')
      .select('*')
      .eq('organization_id', activeOrgId!)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('appointments')
      .select('*, professional:professionals(*), services:appointment_services(*, service:services(*)), payments:appointment_payments(*, payment_method:payment_methods(*))')
      .eq('client_id', id)
      .eq('organization_id', activeOrgId!)
      .order('created_at', { ascending: false }),
    supabase
      .from('client_service_frequencies')
      .select('*, service:services(*), last_professional:professionals(*)')
      .eq('client_id', id)
      .eq('organization_id', activeOrgId!)
      .order('updated_at', { ascending: false }),
    supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', id)
      .eq('organization_id', activeOrgId!)
      .order('contacted_at', { ascending: false }),
    supabase
      .from('client_packages')
      .select('*, package:packages(*)')
      .eq('client_id', id)
      .eq('organization_id', activeOrgId!)
      .order('created_at', { ascending: false }),
    supabase
      .from('packages')
      .select('*')
      .eq('organization_id', activeOrgId!)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('payment_methods')
      .select('*')
      .eq('organization_id', activeOrgId!)
      .eq('is_active', true)
      .order('sort_order'),
  ]);

  if (!clientData) {
    notFound();
  }

  const client = clientData as Client;
  const professionals = (professionalsData || []) as Professional[];
  const services = (servicesData || []) as Service[];
  const appointments = (appointmentsData || []) as Appointment[];
  const frequencies = (frequenciesData || []) as ClientServiceFrequency[];
  const contacts = (contactsData || []) as ClientContact[];
  const clientPackages = (clientPackagesData || []) as ClientPackage[];
  const availablePackages = (availablePackagesData || []) as Package[];
  const paymentMethods = (paymentMethodsData || []) as PaymentMethod[];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Ficha do Cliente</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Edite os dados cadastrais, pacotes e planos vigentes, frequências e histórico de atendimentos de {client.name}
        </p>
      </div>

      {/* Form de Edição */}
      <ClientForm client={client} professionals={professionals} services={services} />

      {/* SEÇÃO PACOTES E PLANOS DO CLIENTE (SPRINT 4) */}
      <ClientPackagesSection
        clientId={id}
        clientPackages={clientPackages}
        availablePackages={availablePackages}
        paymentMethods={paymentMethods}
      />

      {/* SEÇÃO FREQUÊNCIA POR SERVIÇO & HISTÓRICO DE CONTATOS (SPRINT 3) */}
      <ClientServiceFrequencies clientId={id} frequencies={frequencies} contacts={contacts} />

      {/* SEÇÃO HISTÓRICO DE ATENDIMENTOS */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xl">
        <CardHeader className="border-b border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="h-5 w-5 text-amber-400" /> Histórico de Atendimentos
          </CardTitle>
          <Badge variant="outline" className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
            {appointments.length} Atendimento(s)
          </Badge>
        </CardHeader>

        <CardContent className="p-6">
          {appointments.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-6">
              Este cliente ainda não possui atendimentos registrados.
            </p>
          ) : (
            <div className="space-y-4">
              {appointments.map((app) => {
                const servicesText =
                  app.services?.map((s) => s.service?.name).filter(Boolean).join(', ') || 'Serviço';
                const paymentsText =
                  app.payments?.map((p) => p.payment_method?.name).filter(Boolean).join(', ') || '-';

                return (
                  <div
                    key={app.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-300 dark:border-slate-700 transition-all"
                  >
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
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{servicesText}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span>Profissional: {app.professional?.name || 'Vários'}</span>
                        <span>•</span>
                        <span>Pagamento: {paymentsText}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
                      <span className="text-base font-extrabold text-amber-400">
                        {formatCurrency(app.total)}
                      </span>
                      <Link href={`/atendimentos/${app.id}`}>
                        <Badge variant="outline" className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-slate-800">
                          Detalhes
                        </Badge>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

