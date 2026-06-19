import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function buildLabel(names: string[], stopCount: number): string {
  if (names.length === 0) return `${stopCount} tappe`;
  const shown = names.slice(0, 2).join(" → ");
  const extra = stopCount > 2 ? ` (+${stopCount - 2})` : "";
  return `${shown}${extra}`;
}

export async function GET() {
  try {
    const rows = await prisma.routeHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        clientIds: r.clientIds,
        label: r.label,
        totalDistance: r.totalDistance,
        totalDuration: r.totalDuration,
        stopCount: r.stopCount,
      }))
    );
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientIds, totalDistance, totalDuration } = body as {
      clientIds: number[];
      totalDistance: number;
      totalDuration: number;
    };

    if (!clientIds?.length || clientIds.length < 2) {
      return NextResponse.json({ error: "Percorso non valido" }, { status: 400 });
    }

    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, nome: true, cognome: true },
    });
    const byId = new Map(clients.map((c) => [c.id, c]));
    const names = clientIds
      .map((id) => {
        const c = byId.get(id);
        return c ? `${c.cognome} ${c.nome}`.trim() : null;
      })
      .filter(Boolean) as string[];

    const entry = await prisma.routeHistory.create({
      data: {
        clientIds,
        label: buildLabel(names, clientIds.length),
        totalDistance,
        totalDuration,
        stopCount: clientIds.length,
      },
    });

    // Tieni al massimo 50 voci
    const all = await prisma.routeHistory.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (all.length > 50) {
      const toDelete = all.slice(50).map((r) => r.id);
      await prisma.routeHistory.deleteMany({ where: { id: { in: toDelete } } });
    }

    return NextResponse.json({
      id: entry.id,
      createdAt: entry.createdAt.toISOString(),
      clientIds: entry.clientIds,
      label: entry.label,
      totalDistance: entry.totalDistance,
      totalDuration: entry.totalDuration,
      stopCount: entry.stopCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore salvataggio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
