/**
 * Helper para geração de links diretos do WhatsApp no Cabellos.
 */

export function normalizeWhatsAppNumber(phone: string): string {
  if (!phone) return '';

  // Remover tudo que não for dígito
  let clean = phone.replace(/\D/g, '');

  // Se o número tiver 10 ou 11 dígitos (celular/fixo BR sem DDI 55), adicionar 55
  if (clean.length === 10 || clean.length === 11) {
    clean = `55${clean}`;
  }

  return clean;
}

export function generateWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = normalizeWhatsAppNumber(phone);
  if (!cleanPhone) return '';

  const encodedMsg = encodeURIComponent(message || '');
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
}
