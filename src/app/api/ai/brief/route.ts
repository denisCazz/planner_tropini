import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, orgScope } from "@/lib/tenant";
import { aiChat, aiConfigured } from "@/lib/ai";

// Cache breve: un brief al giorno per organizzazione (evita chiamate LLM ripetute)
const briefCache = new Map<string, { date: string; text: string }>();

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const org = orgScope(session!.organizationId);
  const date = todayKey();

  const cached = briefCache.get(session!.organizationId);
  if (cached && cached.date === date) {
    return NextResponse.json({ configured: true, text: cached.text, cached: true });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const fourMonthsAgo = new Date();
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

  const [appointments, urgenti, daVisitare, settings] = await Promise.all([
    prisma.appointment.findMany({
      where: { ...org, date: { gte: todayStart, lt: todayEnd } },
      include: {
        client: { select: { nome: true, cognome: true, citta: true, telefono: true } },
        technician: { select: { username: true } },
      },
      orderBy: { startMin: "asc" },
    }),
    prisma.client.findMany({
      where: { ...org, urgente: true },
      select: { nome: true, cognome: true, citta: true, ultimaVisita: true },
      take: 10,
    }),
    prisma.client.count({
      where: {
        ...org,
        stato: "ATTIVO",
        OR: [{ ultimaVisita: null }, { ultimaVisita: { lt: fourMonthsAgo } }],
      },
    }),
    prisma.settings.findUnique({ where: { organizationId: session!.organizationId } }),
  ]);

  const lines: string[] = [];
  lines.push(`Data: ${date}`);
  lines.push(`Punto di partenza: ${settings?.startLabel ?? "n/d"}`);
  lines.push(
    `Appuntamenti di oggi (${appointments.length}): ` +
      (appointments.length === 0
        ? "nessuno"
        : appointments
            .map((a) => {
              const hh = String(Math.floor(a.startMin / 60)).padStart(2, "0");
              const mm = String(a.startMin % 60).padStart(2, "0");
              return `${hh}:${mm} ${a.client.cognome} ${a.client.nome} (${a.tipo}, ${a.stato}${
                a.technician ? ", tecnico " + a.technician.username : ""
              }${a.client.citta ? ", " + a.client.citta : ""})`;
            })
            .join("; "))
  );
  lines.push(
    `Clienti urgenti (${urgenti.length}): ` +
      (urgenti.length === 0
        ? "nessuno"
        : urgenti.map((c) => `${c.cognome} ${c.nome}${c.citta ? " (" + c.citta + ")" : ""}`).join(", "))
  );
  lines.push(`Attivi da visitare (>4 mesi o mai): ${daVisitare}`);

  const system =
    "Sei l'assistente operativo di una squadra di manutentori di stufe. Scrivi in italiano, in modo pratico e diretto. " +
    "Genera un BRIEF MATTUTINO: massimo 6 righe, con priorità della giornata, rischi e 1-2 azioni concrete. Niente elenchi puntati lunghi.";

  // Fallback senza LLM: brief generato dalle regole
  if (!aiConfigured()) {
    const righe: string[] = [];
    if (appointments.length === 0) {
      righe.push("Nessun appuntamento in agenda oggi: buon momento per recuperare le visite arretrate.");
    } else {
      const pianificati = appointments.filter((a) => a.stato === "PIANIFICATO").length;
      righe.push(
        `Oggi ${appointments.length} appuntamenti${
          pianificati > 0 ? ` (${pianificati} ancora da confermare con il cliente)` : ", tutti confermati"
        }.`
      );
      const senzaTecnico = appointments.filter((a) => !a.technician).length;
      if (senzaTecnico > 0) righe.push(`Attenzione: ${senzaTecnico} senza tecnico assegnato.`);
    }
    if (urgenti.length > 0) {
      righe.push(`Ci sono ${urgenti.length} clienti URGENTI da chiamare: ${urgenti.slice(0, 3).map((c) => `${c.cognome} ${c.nome}`).join(", ")}${urgenti.length > 3 ? "…" : ""}.`);
    }
    if (daVisitare > 0) righe.push(`${daVisitare} clienti attivi sono oltre il ciclo di manutenzione: usa la scheda "Da visitare" per pianificare.`);
    return NextResponse.json({
      configured: false,
      ai: false,
      text: righe.join("\n") || "Giornata tranquilla: nessun arretrato critico.",
    });
  }

  try {
    const result = await aiChat([
      { role: "system", content: system },
      { role: "user", content: lines.join("\n") },
    ]);
    briefCache.set(session!.organizationId, { date, text: result.text });
    return NextResponse.json({ configured: true, text: result.text, cached: false });
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        error: err instanceof Error ? err.message : "Errore AI",
      },
      { status: 502 }
    );
  }
}
