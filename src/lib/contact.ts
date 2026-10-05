export const WHATSAPP_CONTACTS = [
  { name: "GCard-PRÓ", display: "(19) 99002-6467", number: "5519990026467" },
  { name: "Leonardo", display: "(19) 99705-1919", number: "5519997051919" },
  { name: "Paulo", display: "(11) 95294-6565", number: "5511952946565" },
] as const;

export function whatsappLink(number: string, text?: string) {
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
