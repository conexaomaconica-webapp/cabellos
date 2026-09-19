/**
 * Parser de variáveis para modelos de mensagem do Cabellos.
 */

export interface TemplateVariables {
  nome?: string;
  salao?: string;
  servico?: string;
  profissional?: string;
  ultimo_atendimento?: string;
  dias_sem_atendimento?: number | string;
  retorno_previsto?: string;
  pacote?: string;
  saldo_pacote?: number | string;
  validade_pacote?: string;
}

export function parseTemplate(template: string, vars: TemplateVariables): string {
  if (!template) return '';

  let parsed = template;

  parsed = parsed.replace(/\{\{\s*nome\s*\}\}/g, vars.nome || 'Cliente');
  parsed = parsed.replace(/\{\{\s*salao\s*\}\}/g, vars.salao || 'nosso salão');
  parsed = parsed.replace(/\{\{\s*servico\s*\}\}/g, vars.servico || 'serviço');
  parsed = parsed.replace(/\{\{\s*profissional\s*\}\}/g, vars.profissional || 'nosso profissional');
  parsed = parsed.replace(/\{\{\s*ultimo_atendimento\s*\}\}/g, vars.ultimo_atendimento || '');
  parsed = parsed.replace(/\{\{\s*dias_sem_atendimento\s*\}\}/g, String(vars.dias_sem_atendimento ?? '0'));
  parsed = parsed.replace(/\{\{\s*retorno_previsto\s*\}\}/g, vars.retorno_previsto || '');
  parsed = parsed.replace(/\{\{\s*pacote\s*\}\}/g, vars.pacote || 'seu pacote');
  parsed = parsed.replace(/\{\{\s*saldo_pacote\s*\}\}/g, String(vars.saldo_pacote ?? '0'));
  parsed = parsed.replace(/\{\{\s*validade_pacote\s*\}\}/g, vars.validade_pacote || '');

  return parsed;
}

