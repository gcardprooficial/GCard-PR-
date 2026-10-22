export const WHATSAPP_CONTACTS = [
  { name: "Paulo | Suporte", display: "(11) 95294-6565", number: "5511952946565" },
] as const;

export function whatsappLink(number: string, text?: string) {
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
