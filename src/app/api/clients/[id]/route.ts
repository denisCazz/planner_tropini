import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id: parseInt(id) },
  });

  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  return NextResponse.json(client);
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await req.json();

  const {
    nome,
    cognome,
    email,
    telefono,
    telefono2,
    indirizzo,
    cap,
    citta,
    provincia,
    marcaStufa,
    modelloStufa,
    note,
    stato,
    urgente,
    ultimaVisita,
  } = body;

  // Ricalcola lat/lng solo se l'indirizzo è cambiato
  const existing = await prisma.client.findUnique({
    where: { id: parseInt(id) },
  });
  if (!existing) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  let lat = existing.lat;
  let lng = existing.lng;

  if (indirizzo && indirizzo !== existing.indirizzo) {
    const geo = await geocodeAddress(indirizzo);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
    }
  } else if (!indirizzo) {
    lat = null;
    lng = null;
  }

  const updated = await prisma.client.update({
    where: { id: parseInt(id) },
    data: {
      nome,
      cognome: cognome ?? "",
      email: email || null,
      telefono: telefono || null,
      telefono2: telefono2 || null,
      indirizzo: indirizzo || null,
      cap: cap || null,
      citta: citta || null,
      provincia: provincia || null,
      marcaStufa: marcaStufa || null,
      modelloStufa: modelloStufa || null,
      note: note || null,
      stato,
      urgente: urgente ?? false,
      ultimaVisita: ultimaVisita ? new Date(ultimaVisita) : null,
      lat,
      lng,
    },
  });

  return NextResponse.json(updated);
}

/** Imposta solo lat/lng (es. correzione manuale senza cambiare indirizzo) */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const clientId = parseInt(id, 10);
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "Id non valido" }, { status: 400 });
  }

  const body = await req.json();
  const { lat, lng } = body as { lat?: unknown; lng?: unknown };

  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json(
      { error: "lat e lng devono essere numeri" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Coordinate non finite" }, { status: 400 });
  }
  // Bounds approssimativi Italia / confini
  if (lat < 35 || lat > 48 || lng < 5 || lng > 20) {
    return NextResponse.json(
      { error: "Coordinate fuori dall'area Italia prevista" },
      { status: 400 }
    );
  }

  const existing = await prisma.client.findUnique({
    where: { id: clientId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: { lat, lng },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  await prisma.client.delete({ where: { id: parseInt(id) } });

  return NextResponse.json({ ok: true });
}
