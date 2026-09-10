import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, orgScope } from "@/lib/tenant";
import { aiChat, aiConfigured } from "@/lib/ai";

const CICLO_MESI = 12;

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const giorni = Math.max(1, Math.min(14, parseInt(searchParams.get("giorni") ?? "5", 10)));
  const visitePerGiorno = Math.max(1, Math.min(12, parseInt(searchParams.get("perGiorno") ?? "4", 10)));

  const org = orgScope(session!.organizationId);

  const soglia = new Date();
  soglia.setMonth(soglia.getMonth() - CICLO_MESI);

  const [clienti, geoClients, appuntamentiFuturi] = await Promise.all([
    prisma.client.findMany({
      where: {
        ...org,
        stato: "ATTIVO",
        OR: [{ ultimaVisita: null }, { ultimaVisita: { lt: soglia } }],
      },
      select: {
        id: true,
        nome: true,
        cognome: true,
        citta: true,
        provincia: true,
        urgente: true,
        ultimaVisita: true,
        lat: true,
        lng: true,
        telefono: true,
      },
      orderBy: [{ urgente: "desc" }, { ultimaVisita: { sort: "asc", nulls: "first" } }],
      take: 400,
    }),
    prisma.client.findMany({
      where: { ...org, lat: { not: null }, lng: { not: null } },
      select: { id: true, citta: true, lat: true, lng: true },
    }),
    prisma.appointment.count({
      where: {
        ...org,
        date: { gte: new Date() },
        stato: { in: ["PIANIFICATO", "CONFERMATO"] },
      },
    }),
  ]);

  const capacita = giorni * visitePerGiorno;

  // Punteggio: urgenza, anzianità visita, densità di clienti nella stessa città (raggruppamento zona)
  const cityCounts = new Map<string, number>();
  for (const c of geoClients) {
    if (!c.citta) continue;
    cityCounts.set(c.citta, (cityCounts.get(c.citta) ?? 0) + 1);
  }

  const oggi = new Date();
  const scored = clienti.map((c) => {
    const mesi = c.ultimaVisita
      ? (oggi.getTime() - new Date(c.ultimaVisita).getTime()) / (30.44 * 86400000)
      : CICLO_MESI + 6;
    let score = mesi;
    if (c.urgente) score += 24;
    const zona = cityCounts.get(c.citta ?? "") ?? 1;
    score += Math.min(6, zona * 0.5); // premio per zona densa
    return { client: c, score, mesi: Math.round(mesi) };
  });

  scored.sort((a, b) => b.score - a.score);

  const suggeriti = scored.slice(0, capacita).map(({ client, score, mesi }) => ({
    id: client.id,
    nome: `${client.cognome} ${client.nome}`.trim(),
    citta: client.citta,
    provincia: client.provincia,
    urgente: client.urgente,
    telefono: client.telefono,
    mesiDaUltimaVisita: mesi,
    score: Math.round(score),
  }));

  const giorniCoperti = Math.ceil(suggeriti.length / visitePerGiorno);

  let nota: string | null = null;
  if (aiConfigured() && suggeriti.length > 0) {
    try {
      const righe = suggeriti
        .slice(0, 20)
        .map(
          (s, i) =>
            `${i + 1}. ${s.nome}${s.citta ? ` (${s.citta})` : ""}${
              s.mesiDaUltimaVisita >= CICLO_MESI + 6 ? ", mai visitato" : `, visita ${s.mesiDaUltimaVisita} mesi fa`
            }${s.urgente ? ", URGENTE" : ""}`
        )
        .join("\n");
      const result = await aiChat([
        {
          role: "system",
          content:
            "Sei l'assistente di una squadra di manutentori di stufe. In italiano, massimo 4 righe. Spiega brevemente come suddividere queste visite nei prossimi giorni raggruppandole per zona, e indica la prima cosa da fare.",
        },
        {
          role: "user",
          content: `Ho ${giorniCoperti} giorni lavorativi disponibili (max ${visitePerGiorno} visite/giorno). Visite suggerite:\n${righe}`,
        },
      ]);
      nota = result.text;
    } catch {
      nota = null;
    }
  }

  return NextResponse.json({
    giorni,
    visitePerGiorno,
    capacita,
    arretratoTotale: clienti.length,
    appuntamentiGiaPianificati: appuntamentiFuturi,
    suggeriti,
    nota,
  });
}
