/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  aiReply,
  cepReply,
  CEP_RE,
  deliverAudio,
  handoff,
  norm,
  record,
  render,
  say,
  sendModelsWithPhotos,
  type Conv,
} from "./bot.server";
import { sendButtons, supportsNativeButtons } from "./transport.server";

export type FlowButton = { id: string; title: string; next: string | null };
export type FlowNode = {
  type: "text" | "audio" | "buttons" | "ask" | "cep" | "condition" | "ai" | "handoff" | "models" | "goto" | "choice";
  options?: { title: string }[]; // choice: lista numerada; a resposta vira a etiqueta "Origem: …"
  target?: string; // goto: id do nó (ou "start")
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
  trigger: { type: string; keywords?: string[]; button_id?: string }; // first_message também aceita keywords
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
        if (supportsNativeButtons()) {
          const waId = await sendButtons(conv.wa_id, text, buttons);
          await record(conv.id, "bot", "text", `${text}\n[${buttons.map((b) => b.title).join(" | ")}]`, waId);
        } else {
          // Z-API: botão nativo é instável -> lista numerada; o cliente responde o número ou o nome.
          const options = buttons.map((b, i) => `*${i + 1}* - ${b.title}`).join("\n");
          await say(conv, `${text}\n\n${options}\n\nResponda com o número da opção.`);
        }
        await setState(conv, flow.id, id, vars);
        return;
      }
      case "ask":
      case "cep":
        await say(conv, await render(fill(n.text ?? "", conv, vars)));
        await setState(conv, flow.id, id, vars);
        return;
      case "choice": {
        const opts = (n.options ?? []).slice(0, 9);
        const list = opts.map((o, i) => `*${i + 1}* - ${o.title}`).join("\n");
        await say(conv, `${await render(fill(n.text ?? "", conv, vars))}\n\n${list}\n\nResponda com o número.`);
        await setState(conv, flow.id, id, vars);
        return;
      }
      case "models":
        if (n.text) await say(conv, await render(fill(n.text, conv, vars)));
        await sendModelsWithPhotos(conv);
        id = n.next ?? null;
        break;
      case "goto":
        id = n.target === "start" || !n.target ? flow.start : n.target;
        break;
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

/** Grava (ou troca) a etiqueta manual "Origem: …" do contato dessa conversa. */
async function setOrigin(conv: Conv, title: string) {
  const db = await admin();
  const key = conv.wa_id.slice(2, 4) + conv.wa_id.slice(-8);
  const { data: c } = await db.from("wa_contacts").select("id, labels").eq("phone_key", key).maybeSingle();
  const labels = ((c?.labels ?? []) as string[]).filter((l) => !l.startsWith("Origem: "));
  labels.push(`Origem: ${title}`);
  if (c) await db.from("wa_contacts").update({ labels }).eq("id", c.id);
  else await db.from("wa_contacts").insert({ phone_key: key, wa_id: conv.wa_id, name: conv.name, labels, source: "whatsapp" });
}

/** Dispara um fluxo de gatilho "manual" pelo nome (ex.: "origem"). */
export async function startManualFlow(conv: Conv, namePart: string): Promise<boolean> {
  const flow = (await loadFlows()).find((f) => f.trigger.type === "manual" && f.name.toLowerCase().includes(namePart));
  if (!flow?.start) return false;
  await run(conv, flow, flow.start, "", {});
  return true;
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
    const list = node.buttons ?? [];
    const clean = (s: string) => norm(s).replace(/[^a-z0-9 ]/g, "").trim();
    const typed = text ? clean(text) : "";
    const hit =
      list.find((b) => buttonId && b.id === buttonId) ??
      list.find((b) => typed && typed === clean(b.title)) ??
      (/^[1-3]$/.test(typed) ? list[Number(typed) - 1] : undefined);
    if (!hit) {
      await setState(conv, null, null, {});
      return false; // digitou outra coisa: sai do fluxo e o bot normal responde
    }
    await run(conv, flow, hit.next, text ?? "", vars);
    return true;
  }
  if (node.type === "choice") {
    if (kind !== "text" || !text) {
      await setState(conv, null, null, {});
      return false;
    }
    const opts = node.options ?? [];
    const clean = (x: string) => norm(x).replace(/[^a-z0-9 ]/g, "").trim();
    const typed = clean(text);
    let idx = /^[1-9]$/.test(typed) ? Number(typed) - 1 : -1;
    if (idx < 0 || idx >= opts.length) {
      idx = opts.findIndex((o) => {
        const t = clean(o.title);
        return typed === t || (typed.length >= 4 && (t.includes(typed) || typed.includes(t.split(" ")[0] ?? "§")));
      });
    }
    const chosen = idx >= 0 ? opts[idx] : undefined;
    // Pergunta de verdade (não é a resposta da pesquisa): sai do fluxo e o bot normal responde.
    if (!chosen && (text.includes("?") || text.length > 40)) {
      await setState(conv, null, null, {});
      return false;
    }
    if (!chosen) vars["origem_texto"] = text.slice(0, 200);
    await setOrigin(conv, chosen?.title ?? "Outro");
    await run(conv, flow, node.next ?? null, text, vars);
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
        ? ((t.type === "keyword" || t.type === "first_message") && kind === "text" && !!text && hasKeyword(text, t.keywords)) ||
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

/** Depois de uma resposta solta, oferece o menu de novo (nó "nfim" do fluxo de primeira mensagem), pro cliente nunca ficar sem próximo passo. */
export async function offerMenu(conv: Conv): Promise<void> {
  try {
    const flow = (await loadFlows()).find((f) => f.trigger.type === "first_message" && f.nodes["nfim"]);
    if (flow) await run(conv, flow, "nfim", "", {});
  } catch (error) {
    console.error("fluxo: falha ao oferecer menu", error);
  }
}
