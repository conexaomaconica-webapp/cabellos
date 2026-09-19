import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

// Helper to replace exact strings in a file
function fixFile(filename, replacements) {
  const filePath = path.join(migrationsDir, filename);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [search, replace] of replacements) {
    if (!content.includes(search)) {
      console.warn(`[WARN] Search string not found in ${filename}: "${search.slice(0, 40)}..."`);
    } else {
      content = content.replaceAll(search, replace);
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

// 1. 20260917000005_sprint2_triggers_rls.sql
fixFile('20260917000005_sprint2_triggers_rls.sql', [
  ['SELECT id INTO v_linked_prof_id\n        FROM public.professionals', 'SELECT professionals.id INTO v_linked_prof_id\n        FROM public.professionals'],
  ['WHERE id = v_app_id AND organization_id = v_org_id;', 'WHERE appointments.id = v_app_id AND appointments.organization_id = v_org_id;'],
  ['SELECT id, \'Dinheiro\', \'cash\', 1 FROM public.organizations', 'SELECT organizations.id, \'Dinheiro\', \'cash\', 1 FROM public.organizations'],
  ['SELECT id, \'PIX\', \'pix\', 2 FROM public.organizations', 'SELECT organizations.id, \'PIX\', \'pix\', 2 FROM public.organizations'],
  ['SELECT id, \'Cartão de Débito\', \'debit_card\', 3 FROM public.organizations', 'SELECT organizations.id, \'Cartão de Débito\', \'debit_card\', 3 FROM public.organizations'],
  ['SELECT id, \'Cartão de Crédito\', \'credit_card\', 4 FROM public.organizations', 'SELECT organizations.id, \'Cartão de Crédito\', \'credit_card\', 4 FROM public.organizations'],
]);

// 2. 20260917000009_sprint3_cron.sql
fixFile('20260917000009_sprint3_cron.sql', [
  ['FOR v_org IN SELECT id FROM public.organizations WHERE is_active = TRUE LOOP', 'FOR v_org IN SELECT organizations.id FROM public.organizations WHERE is_active = TRUE LOOP']
]);

// 3. 20260917000011_sprint4_triggers_rls_rpcs.sql
fixFile('20260917000011_sprint4_triggers_rls_rpcs.sql', [
  ['WHERE id = v_client_pkg_id;\n\n    RETURN jsonb_build_object', 'WHERE client_packages.id = v_client_pkg_id;\n\n    RETURN jsonb_build_object'],
  ['WHERE id = v_app_id AND organization_id = v_org_id;\n        ELSE\n            INSERT INTO public.appointments', 'WHERE appointments.id = v_app_id AND appointments.organization_id = v_org_id;\n        ELSE\n            INSERT INTO public.appointments'],
  ['WHERE id = v_app_id AND organization_id = v_org_id;\n\n    -- 12. Recalcular', 'WHERE appointments.id = v_app_id AND appointments.organization_id = v_org_id;\n\n    -- 12. Recalcular'],
  ['WHERE id = p_appointment_id;\n\n    -- Void em todas', 'WHERE appointments.id = p_appointment_id;\n\n    -- Void em todas']
]);

// 4. 20260917000013_sprint5_financial_triggers_rls_rpcs.sql
fixFile('20260917000013_sprint5_financial_triggers_rls_rpcs.sql', [
  ['WHERE id = p_cash_register_id;\n\n    RETURN jsonb_build_object', 'WHERE cash_registers.id = p_cash_register_id;\n\n    RETURN jsonb_build_object'],
  ['WHERE id = p_account_receivable_id;\n\n    IF v_ar.appointment_id IS NOT NULL THEN', 'WHERE accounts_receivable.id = p_account_receivable_id;\n\n    IF v_ar.appointment_id IS NOT NULL THEN'],
  ['SELECT * INTO v_pm FROM public.payment_methods WHERE id = p_payment_method_id AND organization_id = v_org_id AND is_active = TRUE;', 'SELECT * INTO v_pm FROM public.payment_methods WHERE payment_methods.id = p_payment_method_id AND payment_methods.organization_id = v_org_id AND payment_methods.is_active = TRUE;'],
  ['WHERE id = p_account_payable_id;\n\n    INSERT INTO public.financial_transactions', 'WHERE accounts_payable.id = p_account_payable_id;\n\n    INSERT INTO public.financial_transactions'],
  ['WHERE id = v_app_id AND organization_id = v_org_id;\n        ELSE\n            INSERT INTO public.appointments', 'WHERE appointments.id = v_app_id AND appointments.organization_id = v_org_id;\n        ELSE\n            INSERT INTO public.appointments'],
  ['SELECT id INTO v_cat_id FROM public.financial_categories WHERE organization_id = v_org_id AND name = \'Atendimentos\' AND type = \'income\' LIMIT 1;', 'SELECT financial_categories.id INTO v_cat_id FROM public.financial_categories WHERE financial_categories.organization_id = v_org_id AND financial_categories.name = \'Atendimentos\' AND financial_categories.type = \'income\' LIMIT 1;'],
  ['WHERE id = v_app_id AND organization_id = v_org_id;\n\n    -- 12. Recalcular', 'WHERE appointments.id = v_app_id AND appointments.organization_id = v_org_id;\n\n    -- 12. Recalcular']
]);

console.log('Finished additional replacements.');

// Fix completed successfully
