export const WHATSAPP_CONTACTS = [
  { name: "GCard-PRÓ", display: "(19) 99002-6467", number: "5519990026467" },
] as const;

export function whatsappLink(number: string, text?: string) {
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
