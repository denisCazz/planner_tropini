import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, orgScope, ownTechnicianFilter } from "@/lib/tenant";
import { parseDateKey } from "@/lib/dates";
import { haversineKm } from "@/lib/geo";
import { interventoInclude, serializeIntervento, serializeAvailability } from "@/lib/serializers";
import { technicianDisplayName } from "@/lib/roles";

function serializeAppointmentRow(a: {
  id: number;
  clientId: number;
  interventoId: number | null;
  technicianId: string | null;
  date: Date;
  startMin: number;
  durationMin: number;
  stato: string;
  tipo: string;
  note: string | null;
  technician?: { username: string; nome: string | null; cognome: string | null } | null;
  client?: {
    nome: string;
    cognome: string;
    ragioneSociale: string | null;
    telefono: string | null;
    indirizzo: string | null;
    citta: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
}) {
  return {
    id: a.id,
    clientId: a.clientId,
    interventoId: a.interventoId,
    technicianId: a.technicianId,
    technicianName: a.technician ? technicianDisplayName(a.technician) : null,
    date: a.date.toISOString().slice(0, 10),
    startMin: a.startMin,
    durationMin: a.durationMin,
    stato: a.stato,
    tipo: a.tipo,
    note: a.note,
    client: a.client
      ? {
          id: a.clientId,
          nome: a.client.nome,
          cognome: a.client.cognome,
          ragioneSociale: a.client.ragioneSociale,
          telefono: a.client.telefono,
          indirizzo: a.client.indirizzo,
          citta: a.client.citta,
          lat: a.client.lat,
          lng: a.client.lng,
        }
      : null,
  };
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const date = parseDateKey(req.nextUrl.searchParams.get("date"));
  if (!date) {
    return NextResponse.json({ error: "Data obbligatoria (YYYY-MM-DD)" }, { status: 400 });
  }
  const technicianIdParam = req.nextUrl.searchParams.get("technicianId");
  const originLat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const originLng = parseFloat(req.nextUrl.searchParams.get("lng") ?? "");
  const radiusKm = parseFloat(req.nextUrl.searchParams.get("radiusKm") ?? "20");
  const org = orgScope(session!.organizationId);
  const own = ownTechnicianFilter(session!);
  const technicianId = own.technicianId ?? (technicianIdParam || null);

  const nextDay = new Date(date.getTime() + 86400000);
  const weekStart = new Date(date);
  const weekEnd = new Date(date.getTime() + 7 * 86400000);

  const [appointments, confirmed, available, toPlan, technicians] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        ...org,
        date,
        stato: { not: "ANNULLATO" },
        ...(technicianId ? { technicianId } : {}),
      },
      include: {
        technician: { select: { username: true, nome: true, cognome: true } },
        client: {
          select: {
            nome: true,
            cognome: true,
            ragioneSociale: true,
            telefono: true,
            indirizzo: true,
            citta: true,
            lat: true,
            lng: true,
          },
        },
      },
      orderBy: { startMin: "asc" },
    }),
    prisma.intervento.findMany({
      where: { ...org, stato: "CONFERMATO", ...own },
      include: interventoInclude,
      take: 80,
    }),
    prisma.intervento.findMany({
      where: { ...org, stato: "DISPONIBILITA_RICEVUTA", ...own },
      include: interventoInclude,
      take: 80,
    }),
    prisma.intervento.findMany({
      where: {
        ...org,
        stato: { in: ["DA_PIANIFICARE", "DA_CONTATTARE"] },
        ...own,
      },
      include: interventoInclude,
      take: 80,
    }),
    prisma.user.findMany({
      where: { ...org, attivo: true },
      select: { id: true, username: true, nome: true, cognome: true, role: true },
      orderBy: { username: "asc" },
    }),
  ]);

  const originFromSettings = await prisma.settings.findUnique({
    where: { organizationId: session!.organizationId },
    select: { startLat: true, startLng: true },
  });

  const origin = {
    lat: Number.isFinite(originLat) ? originLat : originFromSettings?.startLat ?? 44.7089,
    lng: Number.isFinite(originLng) ? originLng : originFromSettings?.startLng ?? 7.6617,
  };

  function withDistance<T extends { client?: { lat: number | null; lng: number | null } | null }>(items: T[]) {
    return items
      .map((item) => {
        const lat = item.client?.lat ?? null;
        const lng = item.client?.lng ?? null;
        const km = lat != null && lng != null ? haversineKm(origin.lat, origin.lng, lat, lng) : null;
        return { ...serializeIntervento(item as never), distanceKm: km };
      })
      .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  }

  const nearby = withDistance(toPlan).filter(
    (i) => i.distanceKm != null && i.distanceKm <= (Number.isFinite(radiusKm) ? radiusKm : 20)
  );

  const weekAvail = await prisma.customerAvailability.findMany({
    where: {
      ...org,
      OR: [
        { date: { gte: date, lt: weekEnd } },
        { tipo: "DISPONIBILE_GIORNO" },
      ],
    },
    take: 200,
  });

  void weekStart;

  return NextResponse.json({
    date: date.toISOString().slice(0, 10),
    technicianId,
    origin,
    appointments: appointments.map(serializeAppointmentRow),
    confirmed: withDistance(confirmed),
    available: withDistance(available),
    toPlan: withDistance(toPlan),
    nearby,
    availabilities: weekAvail.map(serializeAvailability),
    technicians: technicians.map((t) => ({
      id: t.id,
      name: technicianDisplayName(t),
      role: t.role,
    })),
  });
}
