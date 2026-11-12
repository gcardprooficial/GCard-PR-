import { useEffect, useState, type AnchorHTMLAttributes } from "react";
import { appendTracking } from "@/lib/first-touch";

/** Link externo que leva junto a origem da visita (UTM, src, sck): para a compra no Kiwify, por exemplo. */
export function TrackedAnchor({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const [h, setH] = useState(href);
  useEffect(() => setH(appendTracking(href)), [href]);
  return <a href={h} {...rest} />;
}
