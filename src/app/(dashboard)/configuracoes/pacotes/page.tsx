import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { PackageSettingsClient } from '@/components/settings/PackageSettingsClient';

export default async function PackageSettingsPage() {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) {
    return <div className="p-6 text-red-600 font-medium">Selecione uma organização no menu superior.</div>;
  }

  const { data: orgData } = await supabase
    .from('organizations')
    .select('allow_package_usage_with_pending_balance, require_full_payment_for_package_usage, auto_notify_package_expiration, package_expiration_warning_days, allow_package_share_family')
    .eq('id', activeOrgId)
    .single();

  let allowPending = true;
  let requireFullPayment = false;
  let autoNotifyExpiration = true;
  let expirationWarningDays = 7;
  let allowShareFamily = false;

  if (orgData) {
    allowPending = orgData.allow_package_usage_with_pending_balance ?? true;
    requireFullPayment = orgData.require_full_payment_for_package_usage ?? false;
    autoNotifyExpiration = orgData.auto_notify_package_expiration ?? true;
    expirationWarningDays = orgData.package_expiration_warning_days ?? 7;
    allowShareFamily = orgData.allow_package_share_family ?? false;
  } else {
    const { data: fallbackData } = await supabase
      .from('organizations')
      .select('allow_package_usage_with_pending_balance')
      .eq('id', activeOrgId)
      .single();
    if (fallbackData) {
      allowPending = fallbackData.allow_package_usage_with_pending_balance ?? true;
    }
  }

  return (
    <PackageSettingsClient
      initialAllowPending={allowPending}
      initialRequireFullPayment={requireFullPayment}
      initialAutoNotifyExpiration={autoNotifyExpiration}
      initialExpirationWarningDays={expirationWarningDays}
      initialAllowShareFamily={allowShareFamily}
    />
  );
}
