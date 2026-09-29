export function normalizeWhatsAppPhone(value: string): string {
  return value.split("@")[0]?.replace(/\D/g, "") ?? "";
}

export function whatsappPhonesMatch(left: string | null | undefined, right: string | null | undefined) {
  const a = normalizeWhatsAppPhone(left ?? "");
  const b = normalizeWhatsAppPhone(right ?? "");
  if (!a || !b) return false;
  if (a === b) return true;
  // Tolera código do país/DDD e a diferença histórica do nono dígito sem
  // comparar números curtos demais, que poderiam gerar vínculos falsos.
  return a.length >= 10 && b.length >= 10 && a.slice(-8) === b.slice(-8);
}
