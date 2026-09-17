import { getReturnSettingsAction } from '../actions';
import { ReturnSettingsClient } from '@/components/settings/ReturnSettingsClient';

export default async function RetornosSettingsPage() {
  const { data: settings } = await getReturnSettingsAction();

  return (
    <ReturnSettingsClient
      initialSettings={
        settings || {
          default_return_interval_days: 20,
          minimum_visits_for_average: 3,
          alert_lead_days: 7,
          inactive_client_days: 60,
          auto_create_alerts: true,
        }
      }
    />
  );
}
