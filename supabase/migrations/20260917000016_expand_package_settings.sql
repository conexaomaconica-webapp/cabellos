-- Migration 16: Expand Organization Package Settings & Package Extra Benefits
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS require_full_payment_for_package_usage BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS auto_notify_package_expiration BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS package_expiration_warning_days INT DEFAULT 7,
    ADD COLUMN IF NOT EXISTS allow_package_share_family BOOLEAN DEFAULT FALSE;

ALTER TABLE public.packages
    ADD COLUMN IF NOT EXISTS extra_benefits TEXT;
