import { beforeEach, describe, expect, it } from "vitest";
import { __resetCartForTests, addToCart, clearStoredCart, getCartItems, removeFromCartAt, setCartOptions, setCartQty } from "./cart";

const a = { slug: "acrilico-10x10-sem-arte", color: "cristal", qty: 10, chip: false, qr: false };

beforeEach(() => {
  __resetCartForTests();
  clearStoredCart();
});

describe("carrinho", () => {
  it("mesmo produto, cor e opções somam a quantidade", () => {
    addToCart(a);
    addToCart({ ...a, qty: 15 });
    expect(getCartItems()).toEqual([{ ...a, qty: 25 }]);
  });
  it("cor ou opção diferente vira outra linha", () => {
    addToCart(a);
    addToCart({ ...a, color: "preto" });
    addToCart({ ...a, chip: true });
    expect(getCartItems()).toHaveLength(3);
  });
  it("muda quantidade e opções de uma linha", () => {
    addToCart(a);
    setCartQty(0, 40);
    setCartOptions(0, { qr: true });
    expect(getCartItems()[0]).toMatchObject({ qty: 40, qr: true });
  });
  it("limita a quantidade entre 1 e 5000", () => {
    addToCart(a);
    setCartQty(0, 0);
    expect(getCartItems()[0]!.qty).toBe(1);
    setCartQty(0, 99999);
    expect(getCartItems()[0]!.qty).toBe(5000);
  });
  it("remove e limpa", () => {
    addToCart(a);
    addToCart({ ...a, color: "azul" });
    removeFromCartAt(0);
    expect(getCartItems()).toHaveLength(1);
    clearStoredCart();
    expect(getCartItems()).toHaveLength(0);
  });
});
