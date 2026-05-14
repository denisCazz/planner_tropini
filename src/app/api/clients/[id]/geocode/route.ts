import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const clientId = parseInt(id, 10);
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const addr = client.indirizzo?.trim();
  if (!addr) {
    return NextResponse.json(
      { error: "Indirizzo mancante: imposta un indirizzo prima di geocodificare" },
      { status: 400 }
    );
  }

  const geo = await geocodeAddress(addr);
  if (!geo) {
    return NextResponse.json(
      { error: "Indirizzo non trovato dal geocoder" },
      { status: 400 }
    );
  }

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: { lat: geo.lat, lng: geo.lng },
  });

  return NextResponse.json(updated);
}
