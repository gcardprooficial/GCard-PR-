import { createContext, useContext } from "react";

export type PanelUser = { userId: string; email: string };

// Lives outside the route files: importing a route file's exports from a sibling
// route file can end up with two module instances (and two Contexts), which made
// usePanel throw "usePanel fora do painel".
export const PanelCtx = createContext<PanelUser | null>(null);

export function usePanel(): PanelUser {
  const v = useContext(PanelCtx);
  if (!v) throw new Error("usePanel fora do painel");
  return v;
}
