import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { optimizeRoute, getRouteGeometry } from "@/lib/ors";
import type { Client } from "@/types/client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clientIds, visitOrder } = body as {
    clientIds: number[];
    visitOrder?: number[] | null;
  };

  if (!clientIds || clientIds.length < 2) {
    return NextResponse.json(
      { error: "Seleziona almeno 2 clienti" },
      { status: 400 }
    );
  }

  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
  });

  const clientsWithCoords = clients.filter(
    (c: typeof clients[number]) => c.lat !== null && c.lng !== null
  ) as (typeof clients[number] & { lat: number; lng: number })[];

  if (clientsWithCoords.length < 2) {
    return NextResponse.json(
      { error: "I clienti selezionati non hanno coordinate. Verifica gli indirizzi." },
      { status: 400 }
    );
  }

  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
  });

  const startLat = settings?.startLat ?? 44.7089;
  const startLng = settings?.startLng ?? 7.6617;

  const coordIdSet = new Set(clientsWithCoords.map((c) => c.id));

  /** Ordine visita: ottimizzatore ORS oppure sequenza manuale */
  let orderedJobIds: number[];

  try {
    if (visitOrder && visitOrder.length > 0) {
      if (visitOrder.length !== coordIdSet.size) {
        return NextResponse.json(
          { error: "L'ordine manuale deve includere tutte le tappe con coordinate" },
          { status: 400 }
        );
      }
      const seen = new Set<number>();
      for (const id of visitOrder) {
        if (!coordIdSet.has(id) || seen.has(id)) {
          return NextResponse.json(
            { error: "Ordine non valido: id duplicato o cliente senza coordinate" },
            { status: 400 }
          );
        }
        seen.add(id);
      }
      orderedJobIds = visitOrder;
    } else {
      const jobs = clientsWithCoords.map((c) => ({
        id: c.id,
        location: [c.lng, c.lat] as [number, number],
        description: `${c.nome} ${c.cognome}`,
      }));

      const optimResult = await optimizeRoute(startLng, startLat, jobs);

      const route = optimResult.routes[0];
      if (!route) {
        return NextResponse.json(
          { error: "Nessun percorso trovato" },
          { status: 400 }
        );
      }

      orderedJobIds = route.steps
        .filter((s) => s.type === "job" && s.job !== undefined)
        .map((s) => s.job!);
    }

    const orderedClients = orderedJobIds
      .map((jobId, idx) => {
        const client = clientsWithCoords.find((c) => c.id === jobId);
        if (!client) return null;
        return { client: client as unknown as Client, order: idx + 1 };
      })
      .filter(Boolean);

    // Costruisci coordinate per il percorso: start → clienti ordinati → start
    const routeCoords: [number, number][] = [
      [startLng, startLat],
      ...orderedClients.map((s) => [s!.client.lng!, s!.client.lat!] as [number, number]),
      [startLng, startLat],
    ];

    const directionsResult = await getRouteGeometry(routeCoords);
    const feature = directionsResult.features[0];

    const geometry = feature.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number]
    );

    const totalDistance = Math.round(
      (feature.properties.summary.distance / 1000) * 10
    ) / 10;
    const totalDuration = Math.round(
      feature.properties.summary.duration / 60
    );

    return NextResponse.json({
      steps: orderedClients,
      geometry,
      totalDistance,
      totalDuration,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
