import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";
import type { StatoCliente } from "@/types/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stato = searchParams.get("stato") as StatoCliente | null;
  const search = searchParams.get("search") ?? "";

  const clients = await prisma.client.findMany({
    where: {
      ...(stato ? { stato } : {}),
      ...(search
        ? {
            OR: [
              { nome: { contains: search, mode: "insensitive" } },
              { cognome: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { telefono: { contains: search, mode: "insensitive" } },
              { indirizzo: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
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
      ultimaVisita: ultimaVisita ? new Date(ultimaVisita) : null,
      lat,
      lng,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
