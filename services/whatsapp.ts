export function internationalWhatsAppDigits(value?: string | null): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  // A interface brasileira solicita DDD + número (10 ou 11 dígitos).
  // O wa.me exige o código do país e não aceita o símbolo "+".
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function whatsappUrl(
  value?: string | null,
  message?: string,
): string {
  const digits = internationalWhatsAppDigits(value);
  if (!digits) return "";
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}
