/* eslint-disable @typescript-eslint/no-explicit-any */
import { aiReply, cepReply, CEP_RE, deliverAudio, handoff, norm, record, render, say, type Conv } from "./bot.server";
import { sendButtons } from "./graph.server";

export type FlowButton = { id: string; title: string; next: string | null };
export type FlowNode = {
  type: "text" | "audio" | "buttons" | "ask" | "cep" | "condition" | "ai" | "handoff";
  text?: string;
  audio_path?: string | null;
  buttons?: FlowButton[];
  save_as?: string;
  keywords?: string[];
  next?: string | null;
  yes?: string | null;
  no?: string | null;
};
export type Flow = {
  id: string;
  name: string;
  is_active: boolean;
  trigger: { type: string; keywords?: string[]; button_id?: string };
  start: string | null;
  nodes: Record<string, FlowNode>;
  sort_order: number;
};

async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const hasKeyword = (text: string, keywords: string[] = []) => {
  const t = norm(text);
  return keywords.some((raw) => {
    const kw = norm(raw);
    if (!kw) return false;
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(t);
  });
};

async function setState(conv: Conv, flowId: string | null, nodeId: string | null, vars?: Record<string, string>) {
  const db = await admin();
  const patch: Record<string, unknown> = { flow_id: flowId, flow_node: nodeId };
  if (vars) patch["vars"] = vars;
  await db.from("wa_conversations").update(patch).eq("id", conv.id);
}

function fill(template: string, conv: Conv, vars: Record<string, string>): string {
  return template
    .replaceAll("{{nome}}", conv.name?.split(" ")[0] ?? "")
    .replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k === "precos" || k === "modelos" ? m : (vars[k] ?? "")));
}

/** Executa nós em sequência até um nó que espera resposta (botões/pergunta/CEP) ou o fim. */
async function run(conv: Conv, flow: Flow, startId: string | null, lastText: string, vars: Record<string, string>) {
  let id = startId;
  let steps = 0;
  while (id && steps++ < 25) {
    const n = flow.nodes[id];
    if (!n) break;
    switch (n.type) {
      case "text":
        await say(conv, await render(fill(n.text ?? "", conv, vars)));
        id = n.next ?? null;
        break;
      case "audio":
        if (n.audio_path) {
          try {
            await deliverAudio(conv, n.audio_path, "bot");
          } catch (error) {
            console.error("fluxo: falha ao enviar áudio", error);
          }
        }
        id = n.next ?? null;
        break;
      case "buttons": {
        const text = await render(fill(n.text ?? "", conv, vars));
        const buttons = (n.buttons ?? []).slice(0, 3);
        const waId = await sendButtons(conv.wa_id, text, buttons);
        await record(conv.id, "bot", "text", `${text}\n[${buttons.map((b) => b.title).join(" | ")}]`, waId);
        await setState(conv, flow.id, id, vars);
        return;
      }
      case "ask":
      case "cep":
        await say(conv, await render(fill(n.text ?? "", conv, vars)));
        await setState(conv, flow.id, id, vars);
        return;
      case "condition":
        id = hasKeyword(lastText, n.keywords) ? (n.yes ?? null) : (n.no ?? null);
        break;
      case "ai":
        if (!(await aiReply(conv))) {
          await setState(conv, null, null);
          return;
        }
        id = n.next ?? null;
        break;
      case "handoff":
        if (n.text) await say(conv, fill(n.text, conv, vars));
        await handoff(conv, false);
        await setState(conv, null, null, {});
        return;
      default:
        id = null;
    }
  }
  await setState(conv, null, null, {});
}

async function loadFlows(): Promise<Flow[]> {
  const db = await admin();
  const { data } = await db.from("wa_flows").select("*").eq("is_active", true).order("sort_order");
  return (data ?? []) as Flow[];
}

/** Cliente estava no meio de um fluxo (clicou botão / respondeu pergunta). Retorna true se tratou. */
export async function resumeFlow(
  conv: Conv & { flow_id?: string | null; flow_node?: string | null; vars?: Record<string, string> },
  kind: string,
  text: string | null,
  buttonId: string | null,
): Promise<boolean> {
  if (!conv.flow_id || !conv.flow_node) return false;
  const flow = (await loadFlows()).find((f) => f.id === conv.flow_id);
  const node = flow?.nodes[conv.flow_node];
  if (!flow || !node) {
    await setState(conv, null, null, {});
    return false;
  }
  const vars = { ...(conv.vars ?? {}) };

  if (node.type === "buttons") {
    const hit = (node.buttons ?? []).find(
      (b) => (buttonId && b.id === buttonId) || (text && norm(text) === norm(b.title)),
    );
    if (!hit) {
      await setState(conv, null, null, {});
      return false; // digitou outra coisa: sai do fluxo e o bot normal responde
    }
    await run(conv, flow, hit.next, text ?? "", vars);
    return true;
  }
  if (node.type === "ask") {
    if (kind !== "text" || !text) return false;
    if (node.save_as) vars[node.save_as] = text.slice(0, 300);
    await run(conv, flow, node.next ?? null, text, vars);
    return true;
  }
  if (node.type === "cep") {
    const m = text?.match(CEP_RE);
    if (!m) {
      await say(conv, "Não achei um CEP aí 🤔 Manda só os 8 números (ex.: 13344-652).");
      return true;
    }
    vars["cep"] = `${m[1]}${m[2]}`;
    await say(conv, await cepReply(vars["cep"]));
    await run(conv, flow, node.next ?? null, text ?? "", vars);
    return true;
  }
  return false;
}

/**
 * Procura um fluxo cujo gatilho bate. `phase`:
 *  - specific: palavra-chave / áudio / imagem / botão global (antes das respostas rápidas)
 *  - fallback: primeira mensagem / qualquer texto (depois das respostas rápidas)
 */
export async function triggerFlow(
  conv: Conv,
  phase: "specific" | "fallback",
  kind: string,
  text: string | null,
  buttonId: string | null,
  isFirstOrGreeting: boolean,
): Promise<boolean> {
  for (const flow of await loadFlows()) {
    const t = flow.trigger;
    const hit =
      phase === "specific"
        ? (t.type === "keyword" && kind === "text" && !!text && hasKeyword(text, t.keywords)) ||
          (t.type === "audio" && kind === "audio") ||
          (t.type === "image" && kind === "image") ||
          (t.type === "button" && !!buttonId && t.button_id === buttonId)
        : (t.type === "first_message" && isFirstOrGreeting) || (t.type === "any_text" && kind === "text");
    if (hit && flow.start) {
      await run(conv, flow, flow.start, text ?? "", {});
      return true;
    }
  }
  return false;
}
