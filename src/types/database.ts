export type SystemRole = 'master' | 'user';
export type UserRole = 'admin' | 'receptionist' | 'professional';
export type CommissionType = 'none' | 'percentage' | 'fixed' | 'custom';
export type AppointmentStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type PaymentStatus = 'pending' | 'partial' | 'paid';
export type PaymentMethodType = 'cash' | 'pix' | 'debit_card' | 'credit_card' | 'transfer' | 'package' | 'other';

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  timezone: string;
  currency: string;
  allow_package_usage_with_pending_balance?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  system_role: SystemRole;
  created_at: string;
  updated_at: string;
}

export interface OrganizationUser {
  id: string;
  organization_id: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  organization?: Organization;
}

export interface Client {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  birth_date: string | null;
  gender: string | null;
  notes: string | null;
  preferred_professional_id: string | null;
  preferred_service_id: string | null;
  custom_return_interval_days: number | null;
  return_rule_mode: string;
  average_return_days: number | null;
  next_expected_return_at: string | null;
  first_appointment_at: string | null;
  last_appointment_at: string | null;
  total_appointments: number;
  total_spent: number;
  average_ticket: number;
  last_contact_at: string | null;
  allow_whatsapp: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  preferred_professional?: Professional | null;
  preferred_service?: Service | null;
}

export interface Professional {
  id: string;
  organization_id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  commission_type: CommissionType;
  commission_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  services?: Service[];
}

export interface ServiceCategory {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  organization_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  default_return_interval_days: number;
  counts_for_return_frequency: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: ServiceCategory | null;
}

export interface ProfessionalService {
  organization_id: string;
  professional_id: string;
  service_id: string;
  custom_price: number | null;
  custom_commission: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethod {
  id: string;
  organization_id: string;
  name: string;
  type: PaymentMethodType;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  organization_id: string;
  client_id: string;
  professional_id: string | null;
  appointment_date: string;
  started_at: string | null;
  finished_at: string | null;
  status: AppointmentStatus;
  notes: string | null;
  subtotal: number;
  discount: number;
  total: number;
  package_covered_amount?: number;
  amount_due?: number;
  payment_status: PaymentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  professional?: Professional;
  services?: AppointmentService[];
  payments?: AppointmentPayment[];
}

export interface AppointmentService {
  id: string;
  organization_id: string;
  appointment_id: string;
  service_id: string;
  professional_id: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  package_covered_amount?: number;
  client_package_id?: string | null;
  commission_amount: number;
  counts_for_return_frequency: boolean;
  created_at: string;
  updated_at: string;
  service?: Service;
  professional?: Professional;
  client_package?: ClientPackage | null;
}

export interface AppointmentPayment {
  id: string;
  organization_id: string;
  appointment_id: string;
  payment_method_id: string;
  amount: number;
  installments: number;
  notes: string | null;
  paid_at: string;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
  payment_method?: PaymentMethod;
}

// Sprint 3 Types
export type ReturnAlertStatus = 'upcoming' | 'due' | 'overdue' | 'contacted' | 'snoozed' | 'returned' | 'ignored' | 'scheduled';
export type CalculationMode = 'manual' | 'automatic' | 'service_default' | 'global_default';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type TemplateType = 'return_reminder' | 'overdue' | 'inactive_client' | 'package_renewal' | 'package_low_balance' | 'package_expiring' | 'birthday' | 'custom';
export type ContactType = 'whatsapp' | 'phone' | 'instagram' | 'in_person' | 'other';
export type ContactResult = 'sent' | 'no_response' | 'interested' | 'scheduled' | 'declined' | 'returned';

export interface ClientServiceFrequency {
  id: string;
  organization_id: string;
  client_id: string;
  service_id: string;
  last_professional_id: string | null;
  visit_count: number;
  first_service_at: string | null;
  last_service_at: string | null;
  average_interval_days: number | null;
  manual_interval_days: number | null;
  effective_interval_days: number | null;
  next_expected_return_at: string | null;
  calculation_mode: CalculationMode;
  confidence_level: ConfidenceLevel | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  client?: Client;
  service?: Service;
  last_professional?: Professional | null;
}

export interface ReturnAlert {
  id: string;
  organization_id: string;
  client_id: string;
  service_id: string;
  client_service_frequency_id: string | null;
  expected_return_at: string;
  status: ReturnAlertStatus;
  days_overdue: number;
  snoozed_until: string | null;
  snooze_reason: string | null;
  contacted_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  service?: Service;
  frequency?: ClientServiceFrequency;
}

export interface MessageTemplate {
  id: string;
  organization_id: string;
  name: string;
  type: TemplateType;
  content: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientContact {
  id: string;
  organization_id: string;
  client_id: string;
  service_id: string | null;
  return_alert_id: string | null;
  user_id: string;
  contact_type: ContactType;
  message_template_id: string | null;
  message_content: string;
  contacted_at: string;
  result: ContactResult;
  notes: string | null;
  created_at: string;
  service?: Service | null;
  template?: MessageTemplate | null;
}

// Sprint 4 Types (Packages and Service Plans)
export type PackageType = 'credits' | 'subscription' | 'limited_period' | 'unlimited';
export type BillingType = 'one_time' | 'monthly' | 'yearly';
export type ValidityType = 'days' | 'months' | 'years';
export type RuleType = 'service_credit' | 'period_limit' | 'unlimited_service' | 'total_limit';
export type PeriodType = 'week' | 'month' | 'year' | 'custom';
export type ClientPackageStatus = 'active' | 'completed' | 'expired' | 'cancelled';

export interface Package {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  price: number;
  package_type: PackageType;
  billing_type: BillingType;
  validity_type: ValidityType;
  validity_value: number;
  validity_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: PackageItem[];
  rules?: PackageRule[];
}

export interface PackageItem {
  id: string;
  organization_id: string;
  package_id: string;
  service_id: string;
  created_at: string;
  updated_at: string;
  service?: Service;
}

export interface PackageRule {
  id: string;
  organization_id: string;
  package_id: string;
  rule_type: RuleType;
  service_id: string | null;
  limit_quantity: number | null;
  period_type: PeriodType | null;
  period_quantity: number;
  is_unlimited: boolean;
  created_at: string;
  updated_at: string;
  service?: Service | null;
}

export interface ClientPackage {
  id: string;
  organization_id: string;
  client_id: string;
  package_id: string | null;
  purchased_at: string;
  starts_at: string;
  expires_at: string;
  original_price: number;
  discount: number;
  amount_paid: number;
  payment_status: PaymentStatus;
  status: ClientPackageStatus;
  renewed_from_client_package_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  package?: Package | null;
  items?: ClientPackageItem[];
  rules?: ClientPackageRule[];
  usages?: PackageUsage[];
  payments?: ClientPackagePayment[];
}

export interface ClientPackageItem {
  id: string;
  organization_id: string;
  client_package_id: string;
  service_id: string;
  contracted_quantity: number | null;
  used_quantity: number;
  remaining_quantity: number | null;
  created_at: string;
  updated_at: string;
  service?: Service;
}

export interface ClientPackageRule {
  id: string;
  organization_id: string;
  client_package_id: string;
  service_id: string | null;
  rule_type: RuleType;
  limit_quantity: number | null;
  period_type: PeriodType | null;
  period_quantity: number;
  is_unlimited: boolean;
  created_at: string;
  updated_at: string;
  service?: Service | null;
}

export interface PackageUsage {
  id: string;
  organization_id: string;
  client_package_id: string;
  client_package_item_id: string | null;
  client_package_rule_id: string | null;
  appointment_id: string;
  appointment_service_id: string;
  service_id: string;
  professional_id: string | null;
  quantity: number;
  used_at: string;
  voided_at: string | null;
  created_by: string | null;
  created_at: string;
  service?: Service;
  professional?: Professional | null;
  appointment?: Appointment;
}

export interface ClientPackagePayment {
  id: string;
  organization_id: string;
  client_package_id: string;
  payment_method_id: string;
  amount: number;
  installments: number;
  paid_at: string;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
  payment_method?: PaymentMethod;
}

// Sprint 5 Types (Financial System: Cash Register, Transactions, Accounts Payable/Receivable, Commissions)
export type FinancialCategoryType = 'income' | 'expense';
export type CashRegisterStatus = 'open' | 'closed';
export type CashMovementType = 'opening' | 'sale' | 'receipt' | 'supply' | 'withdrawal' | 'expense' | 'closing_adjustment';
export type FinancialTransactionType = 'income' | 'expense';
export type FinancialSourceType = 'appointment_payment' | 'client_package_payment' | 'receivable_payment' | 'payable_payment' | 'manual_income' | 'manual_expense' | 'commission_payment';
export type AccountStatus = 'pending' | 'partial' | 'paid' | 'cancelled';
export type CommissionStatus = 'calculated' | 'approved' | 'paid';

export interface FinancialCategory {
  id: string;
  organization_id: string;
  name: string;
  type: FinancialCategoryType;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CashRegister {
  id: string;
  organization_id: string;
  opened_at: string;
  closed_at: string | null;
  opened_by: string | null;
  closed_by: string | null;
  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  difference: number | null;
  status: CashRegisterStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  movements?: CashMovement[];
}

export interface CashMovement {
  id: string;
  organization_id: string;
  cash_register_id: string;
  type: CashMovementType;
  amount: number;
  description: string | null;
  financial_transaction_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FinancialTransaction {
  id: string;
  organization_id: string;
  cash_register_id: string | null;
  category_id: string | null;
  type: FinancialTransactionType;
  amount: number;
  payment_method_id: string | null;
  description: string | null;
  transaction_date: string;
  source_type: FinancialSourceType | null;
  source_id: string | null;
  appointment_id: string | null;
  client_package_id: string | null;
  professional_id: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  category?: FinancialCategory | null;
  payment_method?: PaymentMethod | null;
  appointment?: Appointment | null;
  client_package?: ClientPackage | null;
  professional?: Professional | null;
}

export interface AccountReceivable {
  id: string;
  organization_id: string;
  client_id: string;
  appointment_id: string | null;
  client_package_id: string | null;
  description: string | null;
  original_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
  client?: Client;
  appointment?: Appointment | null;
  client_package?: ClientPackage | null;
}

export interface AccountPayable {
  id: string;
  organization_id: string;
  supplier_name: string | null;
  category_id: string | null;
  description: string;
  original_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
  category?: FinancialCategory | null;
  payments?: AccountPayablePayment[];
}

export interface AccountPayablePayment {
  id: string;
  organization_id: string;
  account_payable_id: string;
  payment_method_id: string;
  amount: number;
  paid_at: string;
  financial_transaction_id: string | null;
  created_by: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
  payment_method?: PaymentMethod;
}

export interface Commission {
  id: string;
  organization_id: string;
  professional_id: string;
  period_start: string;
  period_end: string;
  production_total: number;
  commission_amount: number;
  status: CommissionStatus;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  account_payable_id: string | null;
  created_at: string;
  updated_at: string;
  professional?: Professional;
  account_payable?: AccountPayable | null;
  items?: CommissionItem[];
}

export interface CommissionItem {
  id: string;
  organization_id: string;
  commission_id: string;
  appointment_service_id: string;
  professional_id: string;
  production_amount: number;
  commission_amount: number;
  created_at: string;
  appointment_service?: AppointmentService;
}



