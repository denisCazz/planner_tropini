import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, orgScope } from "@/lib/tenant";
import { clientDisplayName } from "@/lib/serializers";
import { clientSearchWhere, interventoSearchWhere, rankClientMatch } from "@/lib/search";

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ clients: [], plants: [], interventi: [] });
  }

  const org = orgScope(session!.organizationId);
  const clientText = clientSearchWhere(q);
  const interventoText = interventoSearchWhere(q);

  const [clients, plants, interventi] = await Promise.all([
    prisma.client.findMany({
      where: { ...org, ...clientText },
      select: {
        id: true,
        nome: true,
        cognome: true,
        ragioneSociale: true,
        telefono: true,
        citta: true,
        indirizzo: true,
        codiceCliente: true,
      },
      take: 40,
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    }),
    prisma.plant.findMany({
      where: {
        ...org,
        OR: [
          { matricola: { contains: q, mode: "insensitive" } },
          { modello: { contains: q, mode: "insensitive" } },
          { marca: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        marca: true,
        modello: true,
        matricola: true,
        clientId: true,
        client: { select: { nome: true, cognome: true, ragioneSociale: true } },
      },
      take: 6,
    }),
    prisma.intervento.findMany({
      where: { ...org, ...interventoText },
      select: {
        id: true,
        stato: true,
        tipo: true,
        client: { select: { nome: true, cognome: true, ragioneSociale: true, citta: true } },
      },
      take: 6,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const rankedClients = [...clients]
    .sort(
      (a, b) =>
        rankClientMatch(a, q) - rankClientMatch(b, q) ||
        a.cognome.localeCompare(b.cognome, "it") ||
        a.nome.localeCompare(b.nome, "it")
    )
    .slice(0, 8);

  return NextResponse.json({
    clients: rankedClients.map((c) => ({
      id: c.id,
      displayName: clientDisplayName(c),
      telefono: c.telefono,
      citta: c.citta,
      indirizzo: c.indirizzo,
      codiceCliente: c.codiceCliente,
    })),
    plants: plants.map((p) => ({
      id: p.id,
      clientId: p.clientId,
      label: [p.marca, p.modello, p.matricola].filter(Boolean).join(" · ") || "Impianto",
      clientName: clientDisplayName(p.client),
    })),
    interventi: interventi.map((i) => ({
      id: i.id,
      stato: i.stato,
      tipo: i.tipo,
      clientName: i.client ? clientDisplayName(i.client) : "",
      citta: i.client?.citta ?? null,
    })),
  });
}
