/**
 * Integrazione LLM proattiva. Provider-agnostic: OpenAI o Anthropic via env.
 * Tutte le chiamate sono server-side (mai esporre la chiave al client).
 *
 * Env:
 *  - AI_PROVIDER: "openai" | "anthropic" (default openai)
 *  - AI_API_KEY: chiave API
 *  - AI_MODEL: override modello (default gpt-4o-mini / claude-sonnet-4-20250514)
 */

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiResult {
  text: string;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

export function aiProvider(): "openai" | "anthropic" {
  return process.env.AI_PROVIDER === "anthropic" ? "anthropic" : "openai";
}

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
} as const;

async function callOpenAI(messages: AiMessage[], model: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("Risposta OpenAI malformata");
  return text.trim();
}

async function callAnthropic(messages: AiMessage[], model: string): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.AI_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system,
      messages: rest,
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = Array.isArray(data?.content)
    ? data.content.map((c: { text?: string }) => c.text ?? "").join("")
    : "";
  if (!text) throw new Error("Risposta Anthropic malformata");
  return text.trim();
}

/** Completa una conversazione con il provider configurato. */
export async function aiChat(messages: AiMessage[]): Promise<AiResult> {
  if (!aiConfigured()) {
    throw new Error("AI non configurata: imposta AI_API_KEY (e opz. AI_PROVIDER) nel .env");
  }
  const provider = aiProvider();
  const model = process.env.AI_MODEL || DEFAULT_MODELS[provider];
  const text =
    provider === "anthropic" ? await callAnthropic(messages, model) : await callOpenAI(messages, model);
  return { text };
}
