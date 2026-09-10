import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireSession,
  requireOperator,
  orgScope,
  assertClientInOrg,
  resolveAssignedUser,
  INVALID_ASSIGNEE,
  ownTechnicianFilter,
} from "@/lib/tenant";
import { parseDateKey } from "@/lib/dates";
import {
  isPriorita,
  isStatoIntervento,
  isTipoIntervento,
} from "@/lib/status";
import { interventoInclude, serializeIntervento } from "@/lib/serializers";
import { interventoSearchWhere } from "@/lib/search";

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const stato = searchParams.get("stato");
  const tipo = searchParams.get("tipo");
  const priorita = searchParams.get("priorita");
  const technicianId = searchParams.get("technicianId");
  const clientIdRaw = searchParams.get("clientId");
  const plantIdRaw = searchParams.get("plantId");
  const citta = searchParams.get("citta");
  const provincia = searchParams.get("provincia");
  const marca = searchParams.get("marca");
  const modello = searchParams.get("modello");
  const search = searchParams.get("search") ?? "";
  const from = parseDateKey(searchParams.get("from"));
  const to = parseDateKey(searchParams.get("to"));
  const openOnly = searchParams.get("open") === "1";
  const hasCoords = searchParams.get("hasCoords") === "1";
  const parsedLimit = parseInt(searchParams.get("limit") ?? "200", 10);
  const limit = Math.min(Math.max(Number.isNaN(parsedLimit) ? 200 : parsedLimit, 1), 2000);

  const techOwn = ownTechnicianFilter(session!);

  const where: Prisma.InterventoWhereInput = {
    ...orgScope(session!.organizationId),
    ...techOwn,
  };

  if (stato) {
    const stati = stato.split(",").filter(isStatoIntervento);
    if (stati.length === 1) where.stato = stati[0];
    else if (stati.length > 1) where.stato = { in: stati };
  } else if (openOnly) {
    where.stato = {
      in: [
        "DA_PIANIFICARE",
        "DA_CONTATTARE",
        "CONTATTATO",
        "DISPONIBILITA_RICEVUTA",
        "APPUNTAMENTO_PROPOSTO",
        "CONFERMATO",
        "PIANIFICATO",
        "IN_CORSO",
        "DA_RICONTATTARE",
      ],
    };
  }

  if (tipo && isTipoIntervento(tipo)) where.tipo = tipo;
  if (priorita && isPriorita(priorita)) where.priorita = priorita;

  if (!techOwn.technicianId) {
    if (technicianId === "none") where.technicianId = null;
    else if (technicianId) where.technicianId = technicianId;
  }

  if (clientIdRaw) {
    const clientId = parseInt(clientIdRaw, 10);
    if (!Number.isNaN(clientId)) where.clientId = clientId;
  }
  if (plantIdRaw) {
    const plantId = parseInt(plantIdRaw, 10);
    if (!Number.isNaN(plantId)) where.plantId = plantId;
  }

  if (from || to) {
    where.dataRichiesta = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: new Date(to.getTime() + 86400000) } : {}),
    };
  }

  const clientFilter: Prisma.ClientWhereInput = {};
  if (citta) clientFilter.citta = { contains: citta, mode: "insensitive" };
  if (provincia) clientFilter.provincia = { equals: provincia, mode: "insensitive" };
  if (hasCoords) {
    clientFilter.lat = { not: null };
    clientFilter.lng = { not: null };
  }
  if (Object.keys(clientFilter).length > 0) where.client = clientFilter;

  const plantFilter: Prisma.PlantWhereInput = {};
  if (marca) plantFilter.marca = { contains: marca, mode: "insensitive" };
  if (modello) plantFilter.modello = { contains: modello, mode: "insensitive" };
  if (Object.keys(plantFilter).length > 0) where.plant = plantFilter;

  if (search.trim()) {
    Object.assign(where, interventoSearchWhere(search));
  }

  const rows = await prisma.intervento.findMany({
    where,
    include: interventoInclude,
    orderBy: [{ priorita: "desc" }, { dataRichiesta: "desc" }],
    take: limit,
  });

  return NextResponse.json(rows.map(serializeIntervento));
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireOperator();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const clientId = typeof b.clientId === "number" ? b.clientId : parseInt(String(b.clientId), 10);
  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "Cliente mancante" }, { status: 400 });
  }
  if (!(await assertClientInOrg(clientId, session!.organizationId))) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  let plantId: number | null = null;
  if (b.plantId != null && b.plantId !== "") {
    const parsed = typeof b.plantId === "number" ? b.plantId : parseInt(String(b.plantId), 10);
    if (Number.isNaN(parsed)) {
      return NextResponse.json({ error: "Impianto non valido" }, { status: 400 });
    }
    const plant = await prisma.plant.findFirst({
      where: { id: parsed, clientId, organizationId: session!.organizationId },
      select: { id: true },
    });
    if (!plant) return NextResponse.json({ error: "Impianto non trovato" }, { status: 404 });
    plantId = plant.id;
  }

  const technician = await resolveAssignedUser(b.technicianId, session!.organizationId);
  if (technician === INVALID_ASSIGNEE) {
    return NextResponse.json({ error: "Tecnico non valido" }, { status: 400 });
  }

  const tipo = isTipoIntervento(b.tipo) ? b.tipo : "MANUTENZIONE";
  const priorita = isPriorita(b.priorita) ? b.priorita : b.urgente ? "URGENTE" : "MEDIA";
  const stato = isStatoIntervento(b.stato) ? b.stato : "DA_CONTATTARE";
  const durataStimata =
    typeof b.durataStimata === "number" ? Math.round(b.durataStimata) : 60;

  const intervento = await prisma.intervento.create({
    data: {
      organizationId: session!.organizationId,
      clientId,
      plantId,
      technicianId: technician,
      tipo,
      priorita,
      durataStimata: Math.min(Math.max(durataStimata, 15), 480),
      stato,
      descrizione: typeof b.descrizione === "string" && b.descrizione.trim() ? b.descrizione.trim().slice(0, 2000) : null,
      note: typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 2000) : null,
      data: parseDateKey(b.data),
    },
    include: interventoInclude,
  });

  return NextResponse.json(serializeIntervento(intervento), { status: 201 });
}
