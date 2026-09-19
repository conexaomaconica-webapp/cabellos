'use server';

import { createClient, getActiveOrganizationId } from '@/lib/supabase/server';
import { getEquivalentPeriodDates, generateCsv, calculateVariation } from '@/lib/reports';

export async function getExecutiveReportAction(
  periodKey = 'this_month',
  customStart?: string,
  customEnd?: string
) {
  const supabase = await createClient();
  const orgId = await getActiveOrganizationId();
  if (!orgId) throw new Error('Organização ativa não encontrada.');

  const dates = getEquivalentPeriodDates(periodKey, customStart, customEnd);

  // Período Atual
  const { data: current, error: currentErr } = await supabase.rpc('get_executive_report', {
    p_org_id: orgId,
    p_start_date: dates.startDate,
    p_end_date: dates.endDate,
  });

  if (currentErr) {
    console.error('Erro ao buscar relatório executivo:', currentErr.message);
  }

  // Período Anterior
  const { data: previous, error: prevErr } = await supabase.rpc('get_executive_report', {
    p_org_id: orgId,
    p_start_date: dates.prevStartDate,
    p_end_date: dates.prevEndDate,
  });

  const currentData = currentErr ? null : current;
  const prevData = prevErr ? null : previous;

  return {
    dates,
    current: currentData,
    previous: prevData,
    comparisons: {
      producao: calculateVariation(currentData?.producao_operacional || 0, prevData?.producao_operacional || 0),
      recebimentos: calculateVariation(currentData?.recebimentos || 0, prevData?.recebimentos || 0),
      despesas: calculateVariation(currentData?.despesas_pagas || 0, prevData?.despesas_pagas || 0),
      resultado_caixa: calculateVariation(currentData?.resultado_caixa || 0, prevData?.resultado_caixa || 0),
      atendimentos: calculateVariation(currentData?.atendimentos_concluidos_count || 0, prevData?.atendimentos_concluidos_count || 0),
      ticket_operacional: calculateVariation(currentData?.ticket_medio_operacional || 0, prevData?.ticket_medio_operacional || 0),
    },
  };
}

export async function getClientRetentionReportAction(
  periodKey = 'this_month',
  customStart?: string,
  customEnd?: string
) {
  const supabase = await createClient();
  const orgId = await getActiveOrganizationId();
  if (!orgId) throw new Error('Organização ativa não encontrada.');

  const dates = getEquivalentPeriodDates(periodKey, customStart, customEnd);

  const { data: current, error } = await supabase.rpc('get_client_retention_report', {
    p_org_id: orgId,
    p_start_date: dates.startDate,
    p_end_date: dates.endDate,
  });

  if (error) throw new Error(`Erro ao buscar relatório de clientes: ${error.message}`);

  return {
    dates,
    current,
  };
}

export async function getServicesReportAction(
  periodKey = 'this_month',
  customStart?: string,
  customEnd?: string,
  serviceId?: string,
  categoryId?: string
) {
  const supabase = await createClient();
  const orgId = await getActiveOrganizationId();
  if (!orgId) throw new Error('Organização ativa não encontrada.');

  const dates = getEquivalentPeriodDates(periodKey, customStart, customEnd);

  const { data: current, error } = await supabase.rpc('get_services_report', {
    p_org_id: orgId,
    p_start_date: dates.startDate,
    p_end_date: dates.endDate,
    p_service_id: serviceId || null,
    p_category_id: categoryId || null,
  });

  if (error) throw new Error(`Erro ao buscar relatório de serviços: ${error.message}`);

  return {
    dates,
    current,
  };
}

export async function getProfessionalsReportAction(
  periodKey = 'this_month',
  customStart?: string,
  customEnd?: string,
  professionalId?: string
) {
  const supabase = await createClient();
  const orgId = await getActiveOrganizationId();
  if (!orgId) throw new Error('Organização ativa não encontrada.');

  const dates = getEquivalentPeriodDates(periodKey, customStart, customEnd);

  const { data: current, error } = await supabase.rpc('get_professionals_report', {
    p_org_id: orgId,
    p_start_date: dates.startDate,
    p_end_date: dates.endDate,
    p_professional_id: professionalId || null,
  });

  if (error) throw new Error(`Erro ao buscar relatório de profissionais: ${error.message}`);

  return {
    dates,
    current,
  };
}

export async function getPackagesReportAction(
  periodKey = 'this_month',
  customStart?: string,
  customEnd?: string
) {
  const supabase = await createClient();
  const orgId = await getActiveOrganizationId();
  if (!orgId) throw new Error('Organização ativa não encontrada.');

  const dates = getEquivalentPeriodDates(periodKey, customStart, customEnd);

  const { data: current, error } = await supabase.rpc('get_packages_report', {
    p_org_id: orgId,
    p_start_date: dates.startDate,
    p_end_date: dates.endDate,
  });

  if (error) throw new Error(`Erro ao buscar relatório de pacotes: ${error.message}`);

  return {
    dates,
    current,
  };
}

export async function getFinancialReportAction(
  periodKey = 'this_month',
  customStart?: string,
  customEnd?: string
) {
  const supabase = await createClient();
  const orgId = await getActiveOrganizationId();
  if (!orgId) throw new Error('Organização ativa não encontrada.');

  const dates = getEquivalentPeriodDates(periodKey, customStart, customEnd);

  const { data: current, error } = await supabase.rpc('get_financial_report', {
    p_org_id: orgId,
    p_start_date: dates.startDate,
    p_end_date: dates.endDate,
  });

  if (error) throw new Error(`Erro ao buscar relatório financeiro: ${error.message}`);

  return {
    dates,
    current,
  };
}

export async function exportReportCsvAction(
  reportType: 'clientes_inativos' | 'clientes_atrasados' | 'servicos' | 'profissionais' | 'pacotes' | 'auditoria',
  periodKey = 'this_month',
  customStart?: string,
  customEnd?: string
) {
  const dates = getEquivalentPeriodDates(periodKey, customStart, customEnd);

  switch (reportType) {
    case 'clientes_inativos': {
      const data = await getClientRetentionReportAction(periodKey, customStart, customEnd);
      const headers = ['ID', 'Nome', 'Telefone', 'Último Atendimento', 'Dias Inativo', 'Histórico Produzido (R$)'];
      const rows = (data.current.clientes_inativos || []).map((c: any) => [
        c.id,
        c.name,
        c.phone || '',
        c.last_appointment_at || '',
        c.dias_inativo || 0,
        c.total_historico || 0,
      ]);
      return {
        csv: generateCsv(headers, rows),
        filename: `clientes_inativos_${periodKey}.csv`,
      };
    }
    case 'clientes_atrasados': {
      const data = await getClientRetentionReportAction(periodKey, customStart, customEnd);
      const headers = ['ID Alerta', 'Cliente', 'Telefone', 'Serviço', 'Profissional', 'Vencimento', 'Dias de Atraso'];
      const rows = (data.current.clientes_atrasados || []).map((a: any) => [
        a.alert_id,
        a.client_name,
        a.client_phone || '',
        a.service_name,
        a.professional_name || '',
        a.due_date,
        a.dias_atraso || 0,
      ]);
      return {
        csv: generateCsv(headers, rows),
        filename: `clientes_atrasados_${periodKey}.csv`,
      };
    }
    case 'servicos': {
      const data = await getServicesReportAction(periodKey, customStart, customEnd);
      const headers = ['Serviço', 'Categoria', 'Quantidade', 'Produção Total (R$)', 'Produção Plano (R$)', 'Produção Direta (R$)', 'Ticket Médio (R$)', '% Participação'];
      const rows = (data.current.ranking_servicos || []).map((s: any) => [
        s.service_name,
        s.category_name || 'Sem Categoria',
        s.quantidade,
        s.producao_total,
        s.producao_plano,
        s.producao_direta,
        s.ticket_medio,
        `${s.percentual_producao}%`,
      ]);
      return {
        csv: generateCsv(headers, rows),
        filename: `relatorio_servicos_${periodKey}.csv`,
      };
    }
    case 'profissionais': {
      const data = await getProfessionalsReportAction(periodKey, customStart, customEnd);
      const headers = ['Profissional', 'Atendimentos', 'Serviços', 'Produção Operacional (R$)', 'Ticket Médio (R$)', 'Comissão Gerada (R$)', 'Comissão Calculada (R$)', 'Comissão Aprovada (R$)', 'Comissão Paga (R$)'];
      const rows = (data.current.profissionais || []).map((p: any) => [
        p.professional_name,
        p.atendimentos_count,
        p.servicos_count,
        p.producao_operacional,
        p.ticket_medio_operacional,
        p.comissao_gerada,
        p.comissao_calculada,
        p.comissao_aprovada,
        p.comissao_paga,
      ]);
      return {
        csv: generateCsv(headers, rows),
        filename: `relatorio_profissionais_${periodKey}.csv`,
      };
    }
    case 'pacotes': {
      const data = await getPackagesReportAction(periodKey, customStart, customEnd);
      const headers = ['Produto', 'Tipo', 'Qtd Vendida', 'Receita Recebida (R$)', 'Clientes Ativos', 'Renovações'];
      const rows = (data.current.ranking_produtos || []).map((p: any) => [
        p.package_name,
        p.package_type,
        p.quantidade_vendida,
        p.receita_recebida,
        p.clientes_ativos,
        p.renovacoes_count,
      ]);
      return {
        csv: generateCsv(headers, rows),
        filename: `relatorio_pacotes_${periodKey}.csv`,
      };
    }
    case 'auditoria': {
      const data = await getFinancialReportAction(periodKey, customStart, customEnd);
      const headers = ['ID Transação', 'Tipo', 'Valor (R$)', 'Descrição', 'Origem', 'ID Origem', 'Criado Em', 'Criado Por', 'Anulado Em', 'Anulado Por', 'Motivo Anulação'];
      const rows = (data.current.auditoria_transacoes || []).map((t: any) => [
        t.transaction_id,
        t.type,
        t.amount,
        t.description || '',
        t.source_type || '',
        t.source_id || '',
        t.created_at,
        t.created_by_name || '',
        t.voided_at || '',
        t.voided_by_name || '',
        t.void_reason || '',
      ]);
      return {
        csv: generateCsv(headers, rows),
        filename: `auditoria_transacoes_${periodKey}.csv`,
      };
    }
    default:
      throw new Error('Tipo de relatório para exportação inválido.');
  }
}
