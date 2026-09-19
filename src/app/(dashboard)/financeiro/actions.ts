'use server';

import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function openCashRegisterAction(openingBalance: number) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const { data, error } = await supabase.rpc('open_cash_register', {
    p_opening_balance: openingBalance,
    p_org_id: activeOrgId,
  });

  if (error) return { error: error.message };

  revalidatePath('/financeiro');
  revalidatePath('/financeiro/caixa');
  return { success: true, data };
}

export async function closeCashRegisterAction(cashRegisterId: string, actualClosingBalance: number, notes?: string) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const { data, error } = await supabase.rpc('close_cash_register', {
    p_cash_register_id: cashRegisterId,
    p_actual_closing_balance: actualClosingBalance,
    p_notes: notes || null,
  });

  if (error) return { error: error.message };

  revalidatePath('/financeiro');
  revalidatePath('/financeiro/caixa');
  return { success: true, data };
}

export async function addCashMovementAction(type: 'supply' | 'withdrawal', amount: number, description: string) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };
  if (!description || description.trim().length === 0) return { error: 'Informe uma descrição para a movimentação' };

  const { data, error } = await supabase.rpc('add_cash_movement', {
    p_type: type,
    p_amount: amount,
    p_description: description.trim(),
    p_org_id: activeOrgId,
  });

  if (error) return { error: error.message };

  revalidatePath('/financeiro');
  revalidatePath('/financeiro/caixa');
  return { success: true, data };
}

export async function payAccountReceivableAction(accountReceivableId: string, amount: number, paymentMethodId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('pay_account_receivable', {
    p_account_receivable_id: accountReceivableId,
    p_amount: amount,
    p_payment_method_id: paymentMethodId,
  });

  if (error) return { error: error.message };

  revalidatePath('/financeiro');
  revalidatePath('/financeiro/contas-receber');
  revalidatePath('/atendimentos');
  revalidatePath('/clientes');
  return { success: true, data };
}

export async function payAccountPayableAction(accountPayableId: string, amount: number, paymentMethodId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('pay_account_payable', {
    p_account_payable_id: accountPayableId,
    p_amount: amount,
    p_payment_method_id: paymentMethodId,
  });

  if (error) return { error: error.message };

  revalidatePath('/financeiro');
  revalidatePath('/financeiro/despesas');
  revalidatePath('/financeiro/comissoes');
  return { success: true, data };
}

export interface CreateAccountPayablePayload {
  supplier_name?: string;
  category_id?: string;
  description: string;
  amount: number;
  due_date: string;
}

export async function createAccountPayableAction(payload: CreateAccountPayablePayload) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };
  if (!payload.description || payload.description.trim().length === 0) return { error: 'Informe a descrição da despesa' };
  if (payload.amount <= 0) return { error: 'O valor deve ser maior que 0' };

  const { data, error } = await supabase
    .from('accounts_payable')
    .insert({
      organization_id: activeOrgId,
      supplier_name: payload.supplier_name || null,
      category_id: payload.category_id || null,
      description: payload.description.trim(),
      original_amount: payload.amount,
      paid_amount: 0,
      remaining_amount: payload.amount,
      due_date: payload.due_date,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath('/financeiro/despesas');
  return { success: true, data };
}

export async function calculateCommissionsAction(startDate: string, endDate: string) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };

  const { data, error } = await supabase.rpc('calculate_professional_commissions', {
    p_org_id: activeOrgId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) return { error: error.message };

  revalidatePath('/financeiro/comissoes');
  return { success: true, data };
}

export async function approveCommissionAction(commissionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('approve_commission_and_create_payable', {
    p_commission_id: commissionId,
  });

  if (error) return { error: error.message };

  revalidatePath('/financeiro/comissoes');
  revalidatePath('/financeiro/despesas');
  return { success: true, data };
}

export interface AddManualTransactionPayload {
  type: 'income' | 'expense';
  category_id?: string;
  amount: number;
  payment_method_id: string;
  description: string;
}

export async function addManualTransactionAction(payload: AddManualTransactionPayload) {
  const supabase = await createClient();
  const activeOrgId = await getActiveOrganizationId();

  if (!activeOrgId) return { error: 'Organização não selecionada' };
  if (payload.amount <= 0) return { error: 'O valor deve ser maior que 0' };

  const { data: user } = await supabase.auth.getUser();

  // Buscar forma de pagamento para checar se é espécie
  const { data: pm } = await supabase
    .from('payment_methods')
    .select('type')
    .eq('id', payload.payment_method_id)
    .single();

  let cashRegisterId: string | null = null;
  if (pm?.type === 'cash') {
    const { data: cr } = await supabase
      .from('cash_registers')
      .select('id')
      .eq('organization_id', activeOrgId)
      .eq('status', 'open')
      .single();

    if (!cr) {
      return { error: 'Para movimentações em dinheiro (espécie), o caixa físico precisa estar aberto.' };
    }
    cashRegisterId = cr.id;
  }

  const sourceType = payload.type === 'income' ? 'manual_income' : 'manual_expense';
  const sourceId = crypto.randomUUID();

  const { data: tx, error } = await supabase
    .from('financial_transactions')
    .insert({
      organization_id: activeOrgId,
      cash_register_id: cashRegisterId,
      category_id: payload.category_id || null,
      type: payload.type,
      amount: payload.amount,
      payment_method_id: payload.payment_method_id,
      description: payload.description,
      transaction_date: new Date().toISOString(),
      source_type: sourceType,
      source_id: sourceId,
      created_by: user.user?.id || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (pm?.type === 'cash' && cashRegisterId) {
    await supabase.from('cash_movements').insert({
      organization_id: activeOrgId,
      cash_register_id: cashRegisterId,
      type: payload.type === 'income' ? 'receipt' : 'expense',
      amount: payload.amount,
      description: payload.description,
      financial_transaction_id: tx.id,
      created_by: user.user?.id || null,
    });
  }

  revalidatePath('/financeiro');
  revalidatePath('/financeiro/caixa');
  return { success: true, data: tx };
}
