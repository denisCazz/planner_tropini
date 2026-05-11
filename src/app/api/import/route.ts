import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseKmlBuffer } from "@/lib/kml";
import type { StatoCliente } from "@/types/client";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Nessun file caricato" }, { status: 400 });
  }

  const filename = file.name;
  const lowerName = filename.toLowerCase();

  if (!lowerName.endsWith(".kml") && !lowerName.endsWith(".kmz")) {
    return NextResponse.json(
      { error: "Formato non supportato. Carica un file .kml o .kmz" },
      { status: 400 }
    );
  }

  const buffer = await file.arrayBuffer();

  let parsed;
  try {
    parsed = await parseKmlBuffer(buffer, filename);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore parsing KML";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of parsed) {
    try {
      // Chiave upsert: nome + cognome + coordinate arrotondate (4 decimali ≈ 11m)
      const latRound = item.lat !== null ? Math.round(item.lat * 10000) / 10000 : null;
      const lngRound = item.lng !== null ? Math.round(item.lng * 10000) / 10000 : null;

      // Cerca se esiste già un cliente con stesse coordinate
      const existing = latRound !== null && lngRound !== null
        ? await prisma.client.findFirst({
            where: {
              lat: { gte: latRound - 0.0001, lte: latRound + 0.0001 },
              lng: { gte: lngRound - 0.0001, lte: lngRound + 0.0001 },
              nome: item.nome,
            },
          })
        : null;

      if (existing) {
        await prisma.client.update({
          where: { id: existing.id },
          data: {
            cognome: item.cognome || existing.cognome,
            note: item.note || existing.note,
            lat: item.lat ?? existing.lat,
            lng: item.lng ?? existing.lng,
          },
        });
        updated++;
      } else {
        await prisma.client.create({
          data: {
            nome: item.nome,
            cognome: item.cognome ?? "",
            email: null,
            telefono: null,
            indirizzo: null,
            note: item.note || null,
            stato: (item.stato as StatoCliente) ?? "PROSPECT",
            ultimaVisita: item.ultimaVisita ? new Date(item.ultimaVisita) : null,
            lat: item.lat,
            lng: item.lng,
          },
        });
        created++;
      }
    } catch {
      skipped++;
      errors.push(`Errore su "${item.nome}"`);
    }
  }

  return NextResponse.json({ created, updated, skipped, errors });
}
