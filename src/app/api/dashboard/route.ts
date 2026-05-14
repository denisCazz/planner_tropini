import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mesi = Math.max(1, parseInt(searchParams.get("mesi") ?? "6"));

  const now = new Date();
  const thresholdDate = new Date(now);
  thresholdDate.setMonth(thresholdDate.getMonth() - mesi);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalCount,
    byStato,
    urgentiCount,
    noVisitaCount,
    visitaAnzianaCount,
    urgentiClients,
    daVisitareClients,
    topBrands,
    recentiCount,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.client.groupBy({ by: ["stato"], _count: { _all: true } }),
    prisma.client.count({ where: { urgente: true } }),
    prisma.client.count({ where: { ultimaVisita: null } }),
    prisma.client.count({
      where: { ultimaVisita: { lt: thresholdDate } },
    }),
    prisma.client.findMany({
      where: { urgente: true },
      select: {
        id: true, nome: true, cognome: true,
        telefono: true, citta: true, indirizzo: true,
        ultimaVisita: true, stato: true,
      },
      orderBy: [{ ultimaVisita: { sort: "asc", nulls: "first" } }],
      take: 30,
    }),
    prisma.client.findMany({
      where: {
        stato: "ATTIVO",
        OR: [
          { ultimaVisita: null },
          { ultimaVisita: { lt: thresholdDate } },
        ],
      },
      select: {
        id: true, nome: true, cognome: true,
        telefono: true, citta: true, ultimaVisita: true,
      },
      orderBy: { ultimaVisita: { sort: "asc", nulls: "first" } },
      take: 50,
    }),
    prisma.client.groupBy({
      by: ["marcaStufa"],
      where: { marcaStufa: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { marcaStufa: "desc" } },
      take: 12,
    }),
    prisma.client.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  const statoMap = Object.fromEntries(
    byStato.map((s) => [s.stato, s._count._all])
  );

  return NextResponse.json({
    totalCount,
    attivi: statoMap["ATTIVO"] ?? 0,
    inattivi: statoMap["INATTIVO"] ?? 0,
    prospect: statoMap["PROSPECT"] ?? 0,
    urgentiCount,
    noVisitaCount,
    visitaAnzianaCount,
    recentiCount,
    mesi,
    urgentiClients,
    daVisitareClients,
    topBrands: topBrands
      .filter((b) => b.marcaStufa)
      .map((b) => ({ brand: b.marcaStufa as string, count: b._count._all })),
  });
}
