import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, orgScope, ownTechnicianFilter } from "@/lib/tenant";
import { toLocalDateKey, addDaysToDateKey, parseDateKey } from "@/lib/dates";
import { technicianDisplayName } from "@/lib/roles";

function mapApt(a: {
  id: number;
  startMin: number;
  durationMin: number;
  stato: string;
  tipo: string;
  clientId: number;
  technician: { username: string; nome: string | null; cognome: string | null } | null;
  client: { nome: string; cognome: string; citta: string | null; telefono: string | null };
}) {
  return {
    id: a.id,
    startMin: a.startMin,
    durationMin: a.durationMin,
    stato: a.stato,
    tipo: a.tipo,
    technicianName: a.technician ? technicianDisplayName(a.technician) : null,
    clientName: [a.client.cognome, a.client.nome].filter(Boolean).join(" "),
    citta: a.client.citta,
    telefono: a.client.telefono,
    clientId: a.clientId,
  };
}

const include = {
  technician: { select: { username: true, nome: true, cognome: true } },
  client: { select: { nome: true, cognome: true, citta: true, telefono: true } },
} as const;

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const org = orgScope(session!.organizationId);
  const own = ownTechnicianFilter(session!);
  const today = toLocalDateKey(new Date());
  const tomorrow = addDaysToDateKey(today, 1);
  const todayDate = parseDateKey(today)!;
  const tomorrowDate = parseDateKey(tomorrow)!;

  const [oggi, domani, clientCount, gpsCount, plantCount, openInterventi] = await Promise.all([
    prisma.appointment.findMany({
      where: { ...org, date: todayDate, stato: { not: "ANNULLATO" }, ...own },
      include,
      orderBy: { startMin: "asc" },
      take: 80,
    }),
    prisma.appointment.findMany({
      where: { ...org, date: tomorrowDate, stato: { not: "ANNULLATO" }, ...own },
      include,
      orderBy: { startMin: "asc" },
      take: 80,
    }),
    prisma.client.count({ where: org }),
    prisma.client.count({ where: { ...org, lat: { not: null }, lng: { not: null } } }),
    prisma.plant.count({ where: org }),
    prisma.intervento.count({
      where: { ...org, stato: { notIn: ["COMPLETATO", "ANNULLATO"] } },
    }),
  ]);

  return NextResponse.json({
    today,
    tomorrow,
    oggi: oggi.map(mapApt),
    domani: domani.map(mapApt),
    stats: {
      clients: clientCount,
      withGps: gpsCount,
      plants: plantCount,
      openInterventi,
    },
  });
}
