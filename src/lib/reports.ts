/**
 * Helper Module para Relatórios e Inteligência Gerencial — Cabellos
 * Fornece formatação brasileira, cálculo seguro de período anterior equivalente,
 * variação percentual determinística sem NaN/Infinity e geração protegida de CSV.
 */

export interface PeriodDates {
  startDate: string; // ISO string 00:00:00
  endDate: string;   // ISO string 23:59:59
  prevStartDate: string;
  prevEndDate: string;
  periodKey: string;
}

/**
 * Formata um valor numérico para o padrão monetário brasileiro (R$ 1.234,56).
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata uma data para o padrão brasileiro DD/MM/YYYY.
 */
export function formatDateBR(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/**
 * Calcula o período anterior equivalente para comparação temporal determinística.
 * Preserva o número exato de dias corridos entre start e end (start e end inclusivos).
 */
export function getEquivalentPeriodDates(
  periodKey: string,
  customStart?: string,
  customEnd?: string,
  nowDate = new Date()
): PeriodDates {
  const now = new Date(nowDate);
  let start = new Date(now);
  let end = new Date(now);

  // Set default hours
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);

  switch (periodKey) {
    case 'today':
      break;
    case 'yesterday':
      start.setUTCDate(start.getUTCDate() - 1);
      end.setUTCDate(end.getUTCDate() - 1);
      break;
    case 'this_week': {
      const day = start.getUTCDay();
      const diff = start.getUTCDate() - day + (day === 0 ? -6 : 1); // Segunda-feira
      start.setUTCDate(diff);
      break;
    }
    case 'last_week': {
      const day = start.getUTCDay();
      const diff = start.getUTCDate() - day + (day === 0 ? -6 : 1) - 7;
      start.setUTCDate(diff);
      end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);
      end.setUTCHours(23, 59, 59, 999);
      break;
    }
    case 'this_month':
      start.setUTCDate(1);
      break;
    case 'last_month':
      start.setUTCMonth(start.getUTCMonth() - 1, 1);
      end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1, 0);
      end.setUTCHours(23, 59, 59, 999);
      break;
    case 'last_30_days':
      start.setUTCDate(start.getUTCDate() - 30);
      break;
    case 'this_year':
      start.setUTCMonth(0, 1);
      break;
    case 'custom':
      if (customStart && customEnd) {
        start = new Date(customStart + 'T00:00:00.000Z');
        end = new Date(customEnd + 'T23:59:59.999Z');
      }
      break;
    default:
      start.setUTCDate(1); // Default este mês
      break;
  }

  // Calcular período anterior equivalente com o mesmo número de dias
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  const prevEnd = new Date(start.getTime() - 1);
  prevEnd.setUTCHours(23, 59, 59, 999);

  const prevStart = new Date(prevEnd.getTime() - (diffDays * 24 * 60 * 60 * 1000) + 1);
  prevStart.setUTCHours(0, 0, 0, 0);

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    prevStartDate: prevStart.toISOString(),
    prevEndDate: prevEnd.toISOString(),
    periodKey,
  };
}

/**
 * Helper para variação percentual sem divisão por zero / NaN / Infinity.
 */
export function calculateVariation(current: number, previous: number): {
  percent: number | null;
  label: string;
  type: 'neutral' | 'positive' | 'negative' | 'new';
} {
  if (previous === 0 && current === 0) {
    return { percent: null, label: '— / Sem variação', type: 'neutral' };
  }
  if (previous === 0 && current > 0) {
    return { percent: null, label: 'Novo no período', type: 'new' };
  }
  if (previous === 0 && current < 0) {
    return { percent: null, label: 'Queda de base', type: 'negative' };
  }

  const diff = current - previous;
  const pct = Number(((diff / previous) * 100).toFixed(2));

  if (pct > 0) {
    return { percent: pct, label: `+${pct}%`, type: 'positive' };
  } else if (pct < 0) {
    return { percent: pct, label: `${pct}%`, type: 'negative' };
  } else {
    return { percent: 0, label: '0%', type: 'neutral' };
  }
}

/**
 * Sanitiza células de texto para prevenção contra CSV Injection (Fórmulas Excel = + - @).
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '';

  let str = String(value).trim();

  // Prevenção contra CSV Injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'` + str;
  }

  // Escapar aspas duplas
  if (str.includes('"')) {
    str = str.replace(/"/g, '""');
  }

  // Se contiver vírgulas, quebras de linha ou aspas, envolver entre aspas
  if (/[",\n\r]/.test(str)) {
    return `"${str}"`;
  }

  return str;
}

/**
 * Gera string CSV codificada em UTF-8 com BOM (byte-order-mark) para compatibilidade perfeita com Excel.
 */
export function generateCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const BOM = '\uFEFF';
  const headerLine = headers.map(sanitizeCsvCell).join(';');
  const dataLines = rows.map((row) => row.map(sanitizeCsvCell).join(';'));
  return BOM + [headerLine, ...dataLines].join('\r\n');
}
