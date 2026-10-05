import { aiChat, aiConfigured } from "./ai";
import { addDaysToDateKey, formatItalianDateLong, toLocalDateKey } from "./dates";

export interface ParsedAssignment {
  operatore: string;
  data: string;
  zona: string;
  numeroClienti: number;
  note: string;
}

export interface ParsedCommand {
  assignments: ParsedAssignment[];
  messaggio: string;
}

function stripFence(text: string) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export async function parsePlanningCommand(
  text: string,
  operators: string[]
): Promise<ParsedCommand> {
  const today = toLocalDateKey(new Date());
  const weekday = formatItalianDateLong(today);
  const { text: raw } = await aiChat([
    {
      role: "system",
      content: `Sei l'assistente di pianificazione di Tropini Service (manutenzione stufe, Piemonte).
Oggi è ${weekday} (${today}).
Tecnici registrati: ${operators.length ? operators.join(", ") : "nessuno"}.
Trasforma la richiesta in JSON con questa forma esatta:
{"messaggio":"riepilogo in italiano","assignments":[{"operatore":"","data":"YYYY-MM-DD","zona":"comune","numeroClienti":5,"note":""}]}
Regole: risolvi domani/lunedì/settimana in date reali; salta sabato e domenica se l'utente dice settimana lavorativa; se manca il numero usa 5; zona = solo il comune; se non è una pianificazione, assignments vuoto. Rispondi solo JSON.`,
    },
    { role: "user", content: text },
  ]);
  const parsed = JSON.parse(stripFence(raw)) as ParsedCommand;
  if (!parsed || !Array.isArray(parsed.assignments)) throw new Error("Risposta AI non valida");
  parsed.messaggio = typeof parsed.messaggio === "string" ? parsed.messaggio : "";
  parsed.assignments = parsed.assignments.filter(
    (a) => a && typeof a.operatore === "string" && typeof a.zona === "string" && typeof a.data === "string"
  );
  return parsed;
}

export type SmsIntent = "CONFERMA" | "RIFIUTO" | "ALTRO";

export async function classifySmsReply(body: string): Promise<{ intent: SmsIntent; riassunto: string }> {
  if (!aiConfigured()) return { intent: "ALTRO", riassunto: "" };
  const { text } = await aiChat([
    {
      role: "system",
      content:
        'Classifica la risposta SMS a una richiesta di disponibilità visita. JSON: {"intent":"CONFERMA"|"RIFIUTO"|"ALTRO","riassunto":"max 12 parole"}. Solo JSON.',
    },
    { role: "user", content: body },
  ]);
  const parsed = JSON.parse(stripFence(text)) as { intent?: string; riassunto?: string };
  const intent = parsed.intent === "CONFERMA" || parsed.intent === "RIFIUTO" ? parsed.intent : "ALTRO";
  return { intent, riassunto: parsed.riassunto ?? "" };
}

export { aiConfigured };
