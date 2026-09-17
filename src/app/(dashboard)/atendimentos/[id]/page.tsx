import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { Appointment } from '@/types/database';
import { formatCurrency, formatDate, formatPhoneNumber } from '@/lib/utils';
import { AppointmentDetailsClient } from '@/components/appointments/AppointmentDetailsClient';
import { notFound } from 'next/navigation';

interface AppointmentDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function AppointmentDetailsPage({ params }: AppointmentDetailsPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  const { data: appData } = await supabase
    .from('appointments')
    .select('*, client:clients(*), professional:professionals(*), services:appointment_services(*, service:services(*), professional:professionals(*)), payments:appointment_payments(*, payment_method:payment_methods(*))')
    .eq('id', id)
    .eq('organization_id', activeOrgId!)
    .single();

  if (!appData) {
    notFound();
  }

  const appointment = appData as Appointment;

  return <AppointmentDetailsClient appointment={appointment} />;
}
