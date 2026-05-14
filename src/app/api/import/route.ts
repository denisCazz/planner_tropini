import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseKmlBuffer } from "@/lib/kml";
import type { StatoCliente } from "@/types/client";

// Allow up to 5 minutes for large imports
export const maxDuration = 300;

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(fn));
  }
}

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

  if (parsed.length === 0) {
    return NextResponse.json({ created: 0, updated: 0, skipped: 0, errors: [] });
  }

  // Load all existing clients once — avoids N×findFirst round-trips
  const existingClients = await prisma.client.findMany({
    select: { id: true, nome: true, lat: true, lng: true, cognome: true, telefono: true, telefono2: true, indirizzo: true, cap: true, citta: true, provincia: true, marcaStufa: true, modelloStufa: true, note: true, ultimaVisita: true },
  });

  // Build lookup: "nome|lat4|lng4" → existing record
  const lookup = new Map<string, typeof existingClients[0]>();
  for (const c of existingClients) {
    if (c.lat !== null && c.lng !== null) {
      const key = `${c.nome}|${Math.round(c.lat * 10000)}|${Math.round(c.lng * 10000)}`;
      lookup.set(key, c);
    }
  }

  const toCreate: typeof parsed = [];
  const toUpdate: { id: number; item: typeof parsed[0] }[] = [];

  for (const item of parsed) {
    if (item.lat === null || item.lng === null) {
      toCreate.push(item);
      continue;
    }
    const key = `${item.nome}|${Math.round(item.lat * 10000)}|${Math.round(item.lng * 10000)}`;
    const existing = lookup.get(key);
    if (existing) {
      toUpdate.push({ id: existing.id, item });
    } else {
      toCreate.push(item);
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Batch CREATE — createMany skips duplicates gracefully
  if (toCreate.length > 0) {
    try {
      const result = await prisma.client.createMany({
        data: toCreate.map((item) => ({
          nome: item.nome,
          cognome: item.cognome ?? "",
          email: null,
          telefono: item.telefono || null,
          telefono2: item.telefono2 || null,
          indirizzo: item.indirizzo || null,
          cap: item.cap || null,
          citta: item.citta || null,
          provincia: item.provincia || null,
          marcaStufa: item.marcaStufa || null,
          modelloStufa: item.modelloStufa || null,
          note: item.note || null,
          stato: (item.stato as StatoCliente) ?? "PROSPECT",
          urgente: item.urgente ?? false,
          ultimaVisita: item.ultimaVisita ? new Date(item.ultimaVisita) : null,
          lat: item.lat,
          lng: item.lng,
        })),
        skipDuplicates: true,
      });
      created = result.count;
    } catch (err) {
      errors.push(`Errore batch create: ${err instanceof Error ? err.message : String(err)}`);
      skipped += toCreate.length;
    }
  }

  // Parallel UPDATE in chunks of 20
  await runInBatches(toUpdate, 20, async ({ id, item }) => {
    try {
      const existing = existingClients.find((c) => c.id === id)!;
      await prisma.client.update({
        where: { id },
        data: {
          cognome: item.cognome || existing.cognome,
          telefono: item.telefono || existing.telefono,
          telefono2: item.telefono2 || existing.telefono2,
          indirizzo: item.indirizzo || existing.indirizzo,
          cap: item.cap || existing.cap,
          citta: item.citta || existing.citta,
          provincia: item.provincia || existing.provincia,
          marcaStufa: item.marcaStufa || existing.marcaStufa,
          modelloStufa: item.modelloStufa || existing.modelloStufa,
          note: item.note || existing.note,
          stato: (item.stato as StatoCliente) || "PROSPECT",
          urgente: item.urgente ?? false,
          ultimaVisita: item.ultimaVisita
            ? new Date(item.ultimaVisita)
            : existing.ultimaVisita,
          lat: item.lat ?? existing.lat,
          lng: item.lng ?? existing.lng,
        },
      });
      updated++;
    } catch {
      skipped++;
      errors.push(`Errore update id=${id}`);
    }
  });

  return NextResponse.json({ created, updated, skipped, errors });
}
