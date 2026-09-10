import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, orgScope } from "@/lib/tenant";
import { aiChat, aiConfigured } from "@/lib/ai";

const CICLO_MESI = 12;
const RICAVO_DEFAULT = 120;

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const org = orgScope(session!.organizationId);

  const soglia = new Date();
  soglia.setMonth(soglia.getMonth() - CICLO_MESI);

  const [clienti, avgRow] = await Promise.all([
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
        ultimaVisita: true,
        marcaStufa: true,
        modelloStufa: true,
        urgente: true,
      },
      orderBy: [{ ultimaVisita: { sort: "asc", nulls: "first" } }],
      take: 200,
    }),
    prisma.intervento.aggregate({
      where: org,
      _avg: { ricavo: true },
    }),
  ]);

  const ricavoMedio = avgRow._avg.ricavo ? Number(avgRow._avg.ricavo) : RICAVO_DEFAULT;

  const oggi = new Date();
  const items = clienti.map((c) => {
    const mesiFa = c.ultimaVisita
      ? Math.floor(
          (oggi.getTime() - new Date(c.ultimaVisita).getTime()) / (30.44 * 86400000)
        )
      : null;
    return {
      id: c.id,
      nome: `${c.cognome} ${c.nome}`.trim(),
      citta: c.citta,
      urgente: c.urgente,
      marcaStufa: c.marcaStufa,
      modelloStufa: c.modelloStufa,
      ultimaVisita: c.ultimaVisita ? c.ultimaVisita.toISOString().slice(0, 10) : null,
      mesiDaUltimaVisita: mesiFa,
      giorniRitardo: mesiFa != null ? Math.max(0, (mesiFa - CICLO_MESI) * 30) : null,
    };
  });

  const ricavoPotenziale = Math.round(clienti.length * ricavoMedio);

  let analisi: string | null = null;
  if (aiConfigured() && items.length > 0) {
    try {
      const sample = items
        .slice(0, 25)
        .map(
          (i) =>
            `- ${i.nome}${i.citta ? " (" + i.citta + ")" : ""}: ${
              i.mesiDaUltimaVisita != null
                ? `ultima visita ${i.mesiDaUltimaVisita} mesi fa`
                : "mai visitato"
            }${i.urgente ? ", URGENTE" : ""}`
        )
        .join("\n");
      const result = await aiChat([
        {
          role: "system",
          content:
            "Sei l'assistente di una squadra di manutentori di stufe. Rispondi in italiano, massimo 4 righe, tono pratico. Suggerisci come pianificare le manutenzioni arretrate: priorità, zone, e un obiettivo realistico di visite a settimana.",
        },
        {
          role: "user",
          content: `Manutenzioni dovute (ciclo ${CICLO_MESI} mesi, ricavo medio stimato €${ricavoMedio}):\n${sample}\nTotale: ${items.length} clienti, ricavo potenziale €${ricavoPotenziale}`,
        },
      ]);
      analisi = result.text;
    } catch {
      analisi = null;
    }
  }

  return NextResponse.json({
    cicloMesi: CICLO_MESI,
    ricavoMedio,
    ricavoPotenziale,
    totaleClienti: items.length,
    clienti: items,
    analisi,
  });
}
