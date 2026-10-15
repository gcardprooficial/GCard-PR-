export const WHATSAPP_CONTACTS = [
  { name: "Leonardo", display: "(19) 99705-1919", number: "5519997051919" },
  { name: "Paulo", display: "(11) 95294-6565", number: "5511952946565" },
] as const;

export function whatsappLink(number: string, text?: string) {
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
