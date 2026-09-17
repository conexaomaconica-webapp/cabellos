export type UserRole = 'owner' | 'admin' | 'professional' | 'receptionist';
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
  commission_amount: number;
  counts_for_return_frequency: boolean;
  created_at: string;
  updated_at: string;
  service?: Service;
  professional?: Professional;
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
export type TemplateType = 'return_reminder' | 'overdue' | 'inactive_client' | 'package_renewal' | 'birthday' | 'custom';
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

