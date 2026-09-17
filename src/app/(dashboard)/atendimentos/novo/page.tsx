import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { NewAppointmentForm } from '@/components/appointments/NewAppointmentForm';
import { Client, Professional, Service, PaymentMethod, ProfessionalService } from '@/types/database';

export default async function NewAppointmentPage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  const [
    { data: clientsData },
    { data: professionalsData },
    { data: servicesData },
    { data: paymentMethodsData },
    { data: profServicesData },
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('organization_id', activeOrgId!).eq('is_active', true).order('name'),
    supabase.from('professionals').select('*').eq('organization_id', activeOrgId!).eq('is_active', true).order('name'),
    supabase.from('services').select('*').eq('organization_id', activeOrgId!).eq('is_active', true).order('name'),
    supabase.from('payment_methods').select('*').eq('organization_id', activeOrgId!).eq('is_active', true).order('sort_order'),
    supabase.from('professional_services').select('*').eq('organization_id', activeOrgId!).eq('is_active', true),
  ]);

  const clients = (clientsData || []) as Client[];
  const professionals = (professionalsData || []) as Professional[];
  const services = (servicesData || []) as Service[];
  const paymentMethods = (paymentMethodsData || []) as PaymentMethod[];
  const professionalServices = (profServicesData || []) as ProfessionalService[];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Novo Atendimento</h1>
        <p className="text-sm text-slate-400 mt-1">
          Registre os serviços prestados, profissionais e forma de pagamento
        </p>
      </div>

      <NewAppointmentForm
        clients={clients}
        professionals={professionals}
        services={services}
        paymentMethods={paymentMethods}
        professionalServices={professionalServices}
      />
    </div>
  );
}
