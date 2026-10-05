import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { aiChat, aiConfigured } from "./ai";
import { formatItalianDateLong, parseDateKey, toLocalDateKey } from "./dates";
import { personName } from "./share";
import { summarizeCosts } from "./costi";

export type Campo = "telefono" | "indirizzo" | "stufa" | "ultimaVisita" | "prossimo";

export interface DataQuery {
  tipo: "cliente" | "piani" | "costi";
  nome: string;
  cognome: string;
  citta: string;
  campo: Campo;
  periodo: "oggi" | "mese";
}

export interface AnswerClient {
  id: number;
  nome: string;
  cognome: string;
  ragioneSociale: string | null;
  citta: string | null;
  telefono: string | null;
  telefono2: string | null;
  indirizzo: string | null;
}

const CAMPI: Campo[] = ["telefono", "indirizzo", "stufa", "ultimaVisita", "prossimo"];
const SKIP = new Set([
  "dammi", "dimmi", "il", "lo", "la", "i", "gli", "le", "un", "una", "di", "del", "della", "dei",
  "numero", "telefono", "cellulare", "cliente", "per", "favore", "mi", "puoi", "dire", "che",
]);

function stripFence(text: string) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function contains(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

export function isDataQuestion(text: string) {
  const t = text.toLowerCase();
  if (/\b(pianifica|pianificami)\b/.test(t) && /\b(zona|clienti)\b/.test(t)) return false;
  return /\b(numero|telefono|cellulare|indirizzo|dammi|dimmi|costi|spese|carburante|stufa|ultima visita|appuntament|quanti km|quanto abbiamo speso)\b/.test(t);
}

export function heuristicQuery(text: string): DataQuery {
  const low = text.toLowerCase();
  let tipo: DataQuery["tipo"] = "cliente";
  if (/\b(costi|spese|carburante|quanto abbiamo)\b/.test(low)) tipo = "costi";
  else if (/\b(giornat|piani di oggi|chi esce|chi va)\b/.test(low) && !/\b(numero|telefono)\b/.test(low)) tipo = "piani";

  let campo: Campo = "telefono";
  if (/indirizz/.test(low)) campo = "indirizzo";
  else if (/stuf|modell|marca/.test(low)) campo = "stufa";
  else if (/ultima visita|ultimo intervent/.test(low)) campo = "ultimaVisita";
  else if (/prossim|appuntament/.test(low)) campo = "prossimo";

  const cittaMatch = text.match(/\bdi\s+([A-Za-zÀ-ÿ']+(?:\s+[A-Za-zÀ-ÿ']+){0,2})\s*$/i);
  const citta = cittaMatch?.[1]?.trim() ?? "";
  let rest = citta ? text.replace(new RegExp(`\\bdi\\s+${citta}\\s*$`, "i"), "") : text;
  rest = rest.replace(/^.*\b(?:numero|telefono|cellulare|indirizzo|stufa)\s+di\s+/i, "");
  rest = rest.replace(/^.*\bdi\s+/i, "");
  const parts = rest
    .replace(/[?!.,]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !SKIP.has(w.toLowerCase()));

  return {
    tipo,
    nome: parts[0] ?? "",
    cognome: parts.slice(1).join(" "),
    citta,
    campo,
    periodo: /\bmese\b/.test(low) ? "mese" : "oggi",
  };
}

export async function understandQuestion(text: string): Promise<DataQuery> {
  const fallback = heuristicQuery(text);
  if (!aiConfigured()) return fallback;
  try {
    const { text: raw } = await aiChat([
      {
        role: "system",
        content: `Estrai una domanda sui dati del CRM. Rispondi solo JSON:
{"tipo":"cliente"|"piani"|"costi","nome":"","cognome":"","citta":"","campo":"telefono"|"indirizzo"|"stufa"|"ultimaVisita"|"prossimo","periodo":"oggi"|"mese"}
tipo=cliente per una persona, piani per le giornate, costi per spese o km. Se chiede un numero, campo=telefono. Non inventare la città.`,
      },
      { role: "user", content: text },
    ]);
    const parsed = JSON.parse(stripFence(raw)) as Partial<DataQuery>;
    const campo = CAMPI.includes(parsed.campo as Campo) ? (parsed.campo as Campo) : fallback.campo;
    return {
      tipo: parsed.tipo === "piani" || parsed.tipo === "costi" ? parsed.tipo : "cliente",
      nome: typeof parsed.nome === "string" && parsed.nome.trim() ? parsed.nome.trim() : fallback.nome,
      cognome: typeof parsed.cognome === "string" ? parsed.cognome.trim() : fallback.cognome,
      citta: typeof parsed.citta === "string" ? parsed.citta.trim() : fallback.citta,
      campo,
      periodo: parsed.periodo === "mese" ? "mese" : fallback.periodo,
    };
  } catch {
    return fallback;
  }
}

function displayPerson(c: { nome: string; cognome: string; ragioneSociale?: string | null }) {
  const person = [c.nome, c.cognome].filter(Boolean).join(" ").trim();
  return person || c.ragioneSociale || "Cliente";
}

function templateAnswer(
  q: DataQuery,
  rows: {
    nome: string;
    cognome: string;
    ragioneSociale: string | null;
    citta: string | null;
    telefono: string | null;
    telefono2: string | null;
    indirizzo: string | null;
    cap: string | null;
    marcaStufa: string | null;
    modelloStufa: string | null;
    ultimaVisita: Date | null;
    appointments: { date: Date; startMin: number }[];
  }[]
) {
  if (!rows.length) {
    const who = [q.nome, q.cognome].filter(Boolean).join(" ");
    return `Nessun cliente trovato${who ? ` per ${who}` : ""}${q.citta ? ` a ${q.citta}` : ""}.`;
  }
  return rows
    .map((c) => {
      const name = displayPerson(c);
      const where = c.citta ? `, ${c.citta}` : "";
      if (q.campo === "indirizzo") {
        const address = [c.indirizzo, c.cap, c.citta].filter(Boolean).join(" ") || "indirizzo mancante";
        return `${name}${where}: ${address}`;
      }
      if (q.campo === "stufa") {
        return `${name}${where}: ${[c.marcaStufa, c.modelloStufa].filter(Boolean).join(" ") || "stufa non indicata"}`;
      }
      if (q.campo === "ultimaVisita") {
        const when = c.ultimaVisita ? formatItalianDateLong(c.ultimaVisita.toISOString().slice(0, 10)) : "mai visitato";
        return `${name}${where}: ultima visita ${when}`;
      }
      if (q.campo === "prossimo") {
        const next = c.appointments[0];
        const when = next
          ? `${formatItalianDateLong(next.date.toISOString().slice(0, 10))} alle ${String(Math.floor(next.startMin / 60)).padStart(2, "0")}:${String(next.startMin % 60).padStart(2, "0")}`
          : "nessun appuntamento";
        return `${name}${where}: ${when}`;
      }
      return `${name}${where}: ${c.telefono || c.telefono2 || "nessun numero"}`;
    })
    .join("\n");
}

async function findClients(organizationId: string, q: DataQuery) {
  const nome = q.nome.trim();
  const cognome = q.cognome.trim();
  if (!nome && !cognome) return [];
  const nameOr: Prisma.ClientWhereInput[] = [];
  if (nome && cognome) {
    nameOr.push({ AND: [{ nome: contains(nome) }, { cognome: contains(cognome) }] });
    nameOr.push({ AND: [{ nome: contains(cognome) }, { cognome: contains(nome) }] });
    nameOr.push({ ragioneSociale: contains(`${nome} ${cognome}`) });
  } else {
    const token = nome || cognome;
    nameOr.push({ nome: contains(token) }, { cognome: contains(token) }, { ragioneSociale: contains(token) });
  }
  const today = parseDateKey(toLocalDateKey(new Date()))!;
  const whereCity: Prisma.ClientWhereInput = {
    organizationId,
    AND: [{ OR: nameOr }, ...(q.citta ? [{ citta: contains(q.citta) }] : [])],
  };
  const query = {
    select: {
      id: true,
      nome: true,
      cognome: true,
      ragioneSociale: true,
      citta: true,
      telefono: true,
      telefono2: true,
      indirizzo: true,
      cap: true,
      marcaStufa: true,
      modelloStufa: true,
      ultimaVisita: true,
      appointments: {
        where: { date: { gte: today }, stato: { not: "ANNULLATO" as const } },
        orderBy: { date: "asc" as const },
        take: 1,
        select: { date: true, startMin: true },
      },
    },
    take: 5,
    orderBy: [{ cognome: "asc" as const }, { nome: "asc" as const }],
  };
  let rows = await prisma.client.findMany({ where: whereCity, ...query });
  if (rows.length === 0 && q.citta) {
    rows = await prisma.client.findMany({ where: { organizationId, OR: nameOr }, ...query });
  }
  return rows;
}

async function plansText(organizationId: string) {
  const today = parseDateKey(toLocalDateKey(new Date()))!;
  const plans = await prisma.plan.findMany({
    where: { organizationId, data: today },
    include: {
      technician: { select: { nome: true, cognome: true, username: true } },
      stops: { where: { status: { not: "NON_DISPONIBILE" } }, select: { id: true } },
    },
    orderBy: { id: "asc" },
  });
  if (!plans.length) return "Oggi non ci sono giornate pianificate.";
  return plans
    .map((p) => `${personName(p.technician)}: ${p.stops.length} clienti a ${p.zona}${p.totalDistance != null ? `, ${p.totalDistance} km` : ""} (${p.status})`)
    .join("\n");
}

async function costsText(organizationId: string, periodo: "oggi" | "mese") {
  const todayKey = toLocalDateKey(new Date());
  const from = periodo === "oggi" ? parseDateKey(todayKey)! : parseDateKey(`${todayKey.slice(0, 7)}-01`)!;
  const to = periodo === "oggi" ? parseDateKey(addOne(todayKey))! : parseDateKey(nextMonth(todayKey.slice(0, 7)))!;
  const summary = await summarizeCosts(organizationId, from, to);
  const label = periodo === "oggi" ? "Oggi" : "Questo mese";
  const price = summary.fuel.price != null ? `${summary.fuel.price.toFixed(3)} €/L ${summary.fuel.fuel}` : "prezzo carburante non disponibile";
  return `${label}: ${summary.totali.km} km, carburante stimato ${summary.totali.carburante.toFixed(2)} €, spese ${summary.totali.spese.toFixed(2)} €, totale ${summary.totali.totale.toFixed(2)} € (${price}).`;
}

function addOne(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

function nextMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

export async function answerDataQuestion(organizationId: string, text: string) {
  const q = await understandQuestion(text);
  if (q.tipo === "piani") return { messaggio: await plansText(organizationId), clienti: [] as AnswerClient[] };
  if (q.tipo === "costi") return { messaggio: await costsText(organizationId, q.periodo), clienti: [] as AnswerClient[] };
  if (!q.nome && !q.cognome) {
    return { messaggio: "Dimmi nome e, se la conosci, la città. Per esempio: numero di Cinzia Paduano di Grugliasco.", clienti: [] as AnswerClient[] };
  }
  const rows = await findClients(organizationId, q);
  const template = templateAnswer(q, rows);
  let messaggio = template;
  if (aiConfigured() && rows.length > 0) {
    try {
      const { text: phrase } = await aiChat([
        {
          role: "system",
          content: "Rispondi in italiano in una o due frasi, usando solo i dati forniti. Non inventare numeri o indirizzi.",
        },
        { role: "user", content: `Domanda: ${text}\nDati:\n${template}` },
      ]);
      if (phrase.trim()) messaggio = phrase.trim();
    } catch {
      messaggio = template;
    }
  }
  const clienti: AnswerClient[] = rows.map((c) => ({
    id: c.id,
    nome: c.nome,
    cognome: c.cognome,
    ragioneSociale: c.ragioneSociale,
    citta: c.citta,
    telefono: c.telefono,
    telefono2: c.telefono2,
    indirizzo: c.indirizzo,
  }));
  return { messaggio, clienti };
}
