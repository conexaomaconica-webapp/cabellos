import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

function replaceInFile(filename, search, replace) {
  const filePath = path.join(migrationsDir, filename);
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(search)) {
    console.error(`ERROR: Target snippet not found in ${filename}`);
    console.error(`SEARCH WAS:\n${search}`);
    process.exit(1);
  }
  content = content.replace(search, replace);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully updated ${filename}`);
}

// 1. Fix 20260917000011_sprint4_triggers_rls_rpcs.sql - client_packages
const target11_pkg = `    SELECT jsonb_build_object(
        'id', id,
        'organization_id', organization_id,
        'client_id', client_id,
        'package_id', package_id,
        'starts_at', starts_at,
        'expires_at', expires_at,
        'original_price', original_price,
        'discount', discount,
        'amount_paid', amount_paid,
        'payment_status', payment_status,
        'status', status
    ) INTO v_result
    FROM public.client_packages WHERE client_packages.id = v_client_pkg_id;`;

const replace11_pkg = `    SELECT jsonb_build_object(
        'id', cp.id,
        'organization_id', cp.organization_id,
        'client_id', cp.client_id,
        'package_id', cp.package_id,
        'starts_at', cp.starts_at,
        'expires_at', cp.expires_at,
        'original_price', cp.original_price,
        'discount', cp.discount,
        'amount_paid', cp.amount_paid,
        'payment_status', cp.payment_status,
        'status', cp.status
    ) INTO v_result
    FROM public.client_packages cp WHERE cp.id = v_client_pkg_id;`;

if (fs.readFileSync(path.join(migrationsDir, '20260917000011_sprint4_triggers_rls_rpcs.sql'), 'utf8').includes(target11_pkg)) {
  replaceInFile('20260917000011_sprint4_triggers_rls_rpcs.sql', target11_pkg, replace11_pkg);
}

// 2. Fix 20260917000011_sprint4_triggers_rls_rpcs.sql - appointments
const target11_app = `    SELECT jsonb_build_object(
        'id', id,
        'organization_id', organization_id,
        'client_id', client_id,
        'subtotal', subtotal,
        'discount', discount,
        'total', total,
        'package_covered_amount', package_covered_amount,
        'amount_due', amount_due,
        'payment_status', payment_status,
        'status', status
    ) INTO v_result
    FROM public.appointments WHERE appointments.id = v_app_id;`;

const replace11_app = `    SELECT jsonb_build_object(
        'id', a.id,
        'organization_id', a.organization_id,
        'client_id', a.client_id,
        'subtotal', a.subtotal,
        'discount', a.discount,
        'total', a.total,
        'package_covered_amount', a.package_covered_amount,
        'amount_due', a.amount_due,
        'payment_status', a.payment_status,
        'status', a.status
    ) INTO v_result
    FROM public.appointments a WHERE a.id = v_app_id;`;

if (fs.readFileSync(path.join(migrationsDir, '20260917000011_sprint4_triggers_rls_rpcs.sql'), 'utf8').includes(target11_app)) {
  replaceInFile('20260917000011_sprint4_triggers_rls_rpcs.sql', target11_app, replace11_app);
}

// 3. Fix 20260917000013_sprint5_financial_triggers_rls_rpcs.sql - open cash register
const target13_cr_open = `    SELECT jsonb_build_object(
        'id', id,
        'organization_id', organization_id,
        'opened_at', opened_at,
        'opening_balance', opening_balance,
        'status', status
    ) INTO v_result FROM public.cash_registers WHERE cash_registers.id = v_cash_reg_id;`;

const replace13_cr_open = `    SELECT jsonb_build_object(
        'id', cr.id,
        'organization_id', cr.organization_id,
        'opened_at', cr.opened_at,
        'opening_balance', cr.opening_balance,
        'status', status
    ) INTO v_result FROM public.cash_registers cr WHERE cr.id = v_cash_reg_id;`;

if (fs.readFileSync(path.join(migrationsDir, '20260917000013_sprint5_financial_triggers_rls_rpcs.sql'), 'utf8').includes(target13_cr_open)) {
  replaceInFile('20260917000013_sprint5_financial_triggers_rls_rpcs.sql', target13_cr_open, replace13_cr_open);
}

// 4. Fix 20260917000013_sprint5_financial_triggers_rls_rpcs.sql - close cash register
const target13_cr_close = `    SELECT jsonb_build_object(
        'id', id,
        'organization_id', organization_id,
        'opened_at', opened_at,
        'closed_at', closed_at,
        'opening_balance', opening_balance,
        'closing_balance', closing_balance,
        'expected_balance', expected_balance,
        'difference', difference,
        'status', status
    ) INTO v_result FROM public.cash_registers WHERE cash_registers.id = p_cash_register_id;`;

const replace13_cr_close = `    SELECT jsonb_build_object(
        'id', cr.id,
        'organization_id', cr.organization_id,
        'opened_at', cr.opened_at,
        'closed_at', cr.closed_at,
        'opening_balance', cr.opening_balance,
        'closing_balance', cr.closing_balance,
        'expected_balance', cr.expected_balance,
        'difference', cr.difference,
        'status', status
    ) INTO v_result FROM public.cash_registers cr WHERE cr.id = p_cash_register_id;`;

if (fs.readFileSync(path.join(migrationsDir, '20260917000013_sprint5_financial_triggers_rls_rpcs.sql'), 'utf8').includes(target13_cr_close)) {
  replaceInFile('20260917000013_sprint5_financial_triggers_rls_rpcs.sql', target13_cr_close, replace13_cr_close);
}

// 5. Fix 20260917000013_sprint5_financial_triggers_rls_rpcs.sql - complete_appointment
const target13_app = `    SELECT jsonb_build_object(
        'id', id, 'organization_id', organization_id, 'client_id', client_id,
        'subtotal', subtotal, 'discount', discount, 'total', total,
        'package_covered_amount', package_covered_amount, 'amount_due', amount_due,
        'payment_status', payment_status, 'status', status
    ) INTO v_result FROM public.appointments WHERE appointments.id = v_app_id;`;

const replace13_app = `    SELECT jsonb_build_object(
        'id', a.id, 'organization_id', a.organization_id, 'client_id', a.client_id,
        'subtotal', a.subtotal, 'discount', a.discount, 'total', a.total,
        'package_covered_amount', a.package_covered_amount, 'amount_due', a.amount_due,
        'payment_status', a.payment_status, 'status', a.status
    ) INTO v_result FROM public.appointments a WHERE a.id = v_app_id;`;

if (fs.readFileSync(path.join(migrationsDir, '20260917000013_sprint5_financial_triggers_rls_rpcs.sql'), 'utf8').includes(target13_app)) {
  replaceInFile('20260917000013_sprint5_financial_triggers_rls_rpcs.sql', target13_app, replace13_app);
}

// Fix completed successfully
