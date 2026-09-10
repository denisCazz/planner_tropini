import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildClientAddress, geocodeAddress } from "@/lib/geocode";
import { requireSession } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const clientId = parseInt(id, 10);
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "ID non valido" }, { status: 400 });
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: session!.organizationId },
  });

  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  if (client.lat != null && client.lng != null) {
    return NextResponse.json(client);
  }

  const address = buildClientAddress(client);
  if (!address) {
    return NextResponse.json(
      { error: "Indirizzo mancante: aggiungilo dalla scheda cliente" },
      { status: 400 }
    );
  }

  const geo = await geocodeAddress(address);
  if (!geo) {
    return NextResponse.json(
      { error: "Coordinate non trovate per questo indirizzo" },
      { status: 422 }
    );
  }

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: { lat: geo.lat, lng: geo.lng },
  });

  return NextResponse.json(updated);
}
