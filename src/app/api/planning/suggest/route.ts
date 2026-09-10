import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOperator, orgScope } from "@/lib/tenant";
import { parseDateKey } from "@/lib/dates";
import { packDay } from "@/lib/planning/nextSlot";
import { haversineKm } from "@/lib/geo";

export async function POST(req: NextRequest) {
  const { session, error } = await requireOperator();
  if (error) return error;

  const body = await req.json();
  const technicianId = typeof body.technicianId === "string" ? body.technicianId : "";
  const date = parseDateKey(body.date);
  if (!technicianId || !date) {
    return NextResponse.json({ error: "Tecnico e data obbligatori" }, { status: 400 });
  }

  const org = orgScope(session!.organizationId);
  const dateKey = date.toISOString().slice(0, 10);

  const [appointments, candidates, settings] = await Promise.all([
    prisma.appointment.findMany({
      where: { ...org, technicianId, date, stato: { not: "ANNULLATO" } },
      select: { startMin: true, durationMin: true },
      orderBy: { startMin: "asc" },
    }),
    prisma.intervento.findMany({
      where: {
        ...org,
        stato: { in: ["DISPONIBILITA_RICEVUTA", "CONFERMATO", "DA_PIANIFICARE"] },
        appointment: null,
      },
      include: {
        client: { select: { id: true, lat: true, lng: true, citta: true, nome: true, cognome: true } },
      },
      take: 40,
    }),
    prisma.settings.findUnique({
      where: { organizationId: session!.organizationId },
      select: { startLat: true, startLng: true },
    }),
  ]);

  const origin = {
    lat: settings?.startLat ?? 44.7089,
    lng: settings?.startLng ?? 7.6617,
  };

  const ranked = [...candidates].sort((a, b) => {
    const da =
      a.client.lat != null && a.client.lng != null
        ? haversineKm(origin.lat, origin.lng, a.client.lat, a.client.lng)
        : 999;
    const db =
      b.client.lat != null && b.client.lng != null
        ? haversineKm(origin.lat, origin.lng, b.client.lat, b.client.lng)
        : 999;
    return da - db;
  });

  const packed = packDay(
    appointments,
    ranked.slice(0, 8).map((i) => ({
      interventoId: i.id,
      clientId: i.clientId,
      durationMin: i.durataStimata,
      lat: i.client.lat,
      lng: i.client.lng,
      reason: `${i.client.cognome} ${i.client.nome} · ${i.client.citta ?? ""}`.trim(),
    }))
  );

  const result = {
    ready: true,
    technicianId,
    date: dateKey,
    message:
      packed.length === 0
        ? "Nessun candidato da inserire in giornata."
        : `Proposta: ${packed.length} interventi in sequenza dopo gli appuntamenti già presenti.`,
    suggestedStops: packed,
  };

  await prisma.planningSuggestion.create({
    data: {
      organizationId: session!.organizationId,
      technicianId,
      date,
      payload: result as object,
    },
  });

  return NextResponse.json(result);
}
