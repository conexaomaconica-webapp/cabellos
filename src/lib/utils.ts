import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `55${cleaned}`;
  }
  return cleaned;
}

export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "-";
  const cleaned = phone.replace(/\D/g, "");
  let digits = cleaned;
  if (digits.startsWith("55") && digits.length > 10) {
    digits = digits.slice(2);
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function formatCurrency(value: number | string | null | undefined): string {
  const amount = typeof value === "string" ? parseFloat(value) : value;
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "R$ 0,00";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

/**
 * Transforma um valor numérico ou string digitada em máscara de moeda Real (ex: R$ 1.250,50)
 */
export function maskCurrencyBRL(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'R$ 0,00';

  if (typeof value === 'number') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  const digits = value.replace(/\D/g, '');
  if (!digits) return 'R$ 0,00';

  const cents = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents);
}

/**
 * Converte uma string formatada em Real (ex: "R$ 1.250,50") de volta para número float (1250.50)
 */
export function unmaskCurrencyBRL(maskedValue: string | null | undefined): number {
  if (!maskedValue) return 0;
  const digits = String(maskedValue).replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
