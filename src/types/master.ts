export type SystemRole = 'master' | 'user';
export type TenantStatus = 'active' | 'suspended' | 'archived';
export type ProvisioningStatus = 'ready' | 'pending_admin' | 'failed';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'expired';
export type BillingCycle = 'monthly' | 'yearly' | 'manual';
export type BackupType = 'manual_export' | 'scheduled_export';
export type BackupStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';

export type FeatureKey =
  | 'financial_module'
  | 'reports_module'
  | 'packages_module'
  | 'returns_module'
  | 'csv_export'
  | 'advanced_reports';

export interface SaasPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number;
  trial_days: number;
  max_users: number;
  max_professionals: number;
  max_clients: number;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  features?: SaasPlanFeature[];
}

export interface SaasPlanFeature {
  id: string;
  plan_id: string;
  feature_key: FeatureKey;
  enabled: boolean;
  limit_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSubscription {
  id: string;
  organization_id: string;
  saas_plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  started_at: string;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  price_snapshot: number;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
  plan?: SaasPlan;
}

export interface SubscriptionEvent {
  id: string;
  organization_subscription_id: string;
  organization_id: string;
  event_type: string;
  old_plan_id: string | null;
  new_plan_id: string | null;
  old_status: string | null;
  new_status: string | null;
  effective_at: string;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export interface TenantBackup {
  id: string;
  organization_id: string;
  requested_by: string;
  type: BackupType;
  status: BackupStatus;
  storage_path: string | null;
  started_at: string;
  completed_at: string | null;
  expires_at: string | null;
  size_bytes: number;
  checksum_algorithm: string;
  checksum: string | null;
  error_message: string | null;
  created_at: string;
  organization_name?: string;
  requested_by_email?: string;
}

export interface MasterAuditLog {
  id: string;
  master_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  organization_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  master_user_name?: string;
  master_user_email?: string;
}

export interface PlatformSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface MasterDashboardMetrics {
  active_tenants: number;
  trial_tenants: number;
  suspended_tenants: number;
  mrr: number;
  arr: number;
  total_users: number;
  total_clients: number;
}

export interface MasterOrganizationListItem {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  status: TenantStatus;
  provisioning_status: ProvisioningStatus;
  created_at: string;
  admin_email?: string;
  admin_name?: string;
  plan_name?: string;
  subscription_status?: SubscriptionStatus;
  users_count: number;
  clients_count: number;
  professionals_count: number;
}
