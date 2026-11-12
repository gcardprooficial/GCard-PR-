import { useSyncExternalStore } from "react";

/** Item do carrinho da loja. Preço não é guardado: é calculado de novo a cada tela (e, na compra, pelo servidor). */
export type CartItem = { slug: string; color: string | null; qty: number; chip: boolean; qr: boolean };

const KEY = "gcard-cart-v2";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMPTY: CartItem[] = [];

let mem: CartItem[] | null = null; // null = ainda não lido do navegador
const listeners = new Set<() => void>();

const valid = (x: unknown): x is CartItem => {
  const i = x as CartItem;
  return !!i && typeof i.slug === "string" && (i.color === null || typeof i.color === "string") && Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 5000 && typeof i.chip === "boolean" && typeof i.qr === "boolean";
};

function load(): CartItem[] {
  if (mem) return mem;
  mem = [];
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as { at?: number; items?: unknown[] }) : null;
    if (v && typeof v.at === "number" && Date.now() - v.at < TTL_MS && Array.isArray(v.items)) mem = v.items.filter(valid);
  } catch {
    /* sem armazenamento: o carrinho vale só nesta aba */
  }
  return mem;
}

function save(items: CartItem[]) {
  mem = items;
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), items }));
  } catch {
    /* sem armazenamento */
  }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  // Outra aba mudou o carrinho: lê de novo.
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      mem = null;
      listeners.forEach((l) => l());
    }
  });
}

const same = (a: CartItem, b: CartItem) => a.slug === b.slug && a.color === b.color && a.chip === b.chip && a.qr === b.qr;

export const getCartItems = (): CartItem[] => load();

/** Mesmo produto, cor e opções somam a quantidade (como numa loja). */
export function addToCart(item: CartItem) {
  const cur = load();
  const i = cur.findIndex((x) => same(x, item));
  save(i >= 0 ? cur.map((x, j) => (j === i ? { ...x, qty: Math.min(5000, x.qty + item.qty) } : x)) : [...cur, item]);
}
export function setCartQty(index: number, qty: number) {
  save(load().map((x, j) => (j === index ? { ...x, qty: Math.max(1, Math.min(5000, Math.trunc(qty))) } : x)));
}
export function setCartOptions(index: number, opts: Partial<Pick<CartItem, "chip" | "qr">>) {
  save(load().map((x, j) => (j === index ? { ...x, ...opts } : x)));
}
export function removeFromCartAt(index: number) {
  save(load().filter((_, j) => j !== index));
}
export function clearStoredCart() {
  save([]);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Itens do carrinho, atualizando a tela sozinha quando mudam. No servidor vem vazio. */
export function useCartItems(): CartItem[] {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}
export const cartCount = (items: CartItem[]) => items.length;

/** Só para testes. */
export function __resetCartForTests() {
  mem = null;
}
