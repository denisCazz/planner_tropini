import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";
import type { StatoCliente } from "@/types/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stato = searchParams.get("stato") as StatoCliente | null;
  const search = searchParams.get("search") ?? "";
  // ?slim=1 → solo campi necessari per la mappa (molto più veloce)
  const slim = searchParams.get("slim") === "1";

  const where = {
    ...(stato ? { stato } : {}),
    ...(search
      ? {
          OR: [
            { nome: { contains: search, mode: "insensitive" as const } },
            { cognome: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { telefono: { contains: search, mode: "insensitive" as const } },
            { indirizzo: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  if (slim) {
    const clients = await prisma.client.findMany({
      where,
      select: {
        id: true,
        nome: true,
        cognome: true,
        telefono: true,
        indirizzo: true,
        citta: true,
        stato: true,
        urgente: true,
        lat: true,
        lng: true,
      },
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    });
    return NextResponse.json(clients);
  }

  const clients = await prisma.client.findMany({
    where,
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
  });

  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
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

  if (!nome) {
    return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
  }

  let lat: number | null = null;
  let lng: number | null = null;

  if (indirizzo) {
    const geo = await geocodeAddress(indirizzo);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
    }
  }

  const client = await prisma.client.create({
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
      stato: stato ?? "PROSPECT",
      urgente: urgente ?? false,
      ultimaVisita: ultimaVisita ? new Date(ultimaVisita) : null,
      lat,
      lng,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
