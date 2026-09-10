import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";
import { requireSession, requireOperator, orgScope, resolveAssignedUser, INVALID_ASSIGNEE } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getClientForOrg(id: string, organizationId: string) {
  const clientId = parseInt(id, 10);
  if (Number.isNaN(clientId)) return null;
  return prisma.client.findFirst({
    where: { id: clientId, organizationId },
  });
}

async function clientWithAssignee(id: number) {
  const row = await prisma.client.findUnique({
    where: { id },
    include: {
      assignedUser: { select: { username: true, nome: true, cognome: true } },
      plants: { orderBy: { createdAt: "desc" } },
      addresses: { orderBy: { createdAt: "desc" } },
      availabilities: { orderBy: { createdAt: "desc" }, take: 20 },
      interventi: {
        include: {
          plant: { select: { id: true, marca: true, modello: true, matricola: true, tipologia: true } },
          technician: { select: { username: true, nome: true, cognome: true } },
          appointment: { select: { id: true, date: true, startMin: true, durationMin: true, stato: true, technicianId: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      appointments: { orderBy: [{ date: "desc" }, { startMin: "asc" }], take: 20 },
      clientNotes: { where: { plantId: null, interventoId: null }, orderBy: { createdAt: "desc" }, take: 30 },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!row) return null;
  const { assignedUser, ...c } = row;
  return {
    ...c,
    assignedUserName: assignedUser
      ? [assignedUser.nome, assignedUser.cognome].filter(Boolean).join(" ").trim() || assignedUser.username
      : null,
  };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const client = await getClientForOrg(id, session!.organizationId);

  if (!client) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  return NextResponse.json(await clientWithAssignee(client.id));
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const existing = await getClientForOrg(id, session!.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const body = await req.json();
  const {
    nome,
    cognome,
    ragioneSociale,
    email,
    telefono,
    telefono2,
    codiceFiscale,
    partitaIva,
    codiceCliente,
    indirizzo,
    civico,
    cap,
    citta,
    provincia,
    marcaStufa,
    modelloStufa,
    note,
    stato,
    urgente,
    ultimaVisita,
    assignedUserId,
  } = body;

  const assignedId = await resolveAssignedUser(assignedUserId, session!.organizationId);
  if (assignedId === INVALID_ASSIGNEE) {
    return NextResponse.json({ error: "Tecnico non valido" }, { status: 400 });
  }

  let lat = existing.lat;
  let lng = existing.lng;
  let geoStatus = existing.geoStatus;

  const addressChanged =
    indirizzo !== existing.indirizzo ||
    civico !== existing.civico ||
    cap !== existing.cap ||
    citta !== existing.citta;

  if (addressChanged && (indirizzo || citta)) {
    const query = [indirizzo, civico, cap, citta, provincia].filter(Boolean).join(", ");
    const geo = await geocodeAddress(query);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      geoStatus = "ok";
    } else {
      geoStatus = "not_found";
    }
  } else if (!indirizzo && !citta) {
    lat = null;
    lng = null;
    geoStatus = "missing";
  }

  const updated = await prisma.client.update({
    where: { id: existing.id },
    data: {
      nome,
      cognome: cognome ?? "",
      ragioneSociale: ragioneSociale || null,
      email: email || null,
      telefono: telefono || null,
      telefono2: telefono2 || null,
      codiceFiscale: codiceFiscale || null,
      partitaIva: partitaIva || null,
      codiceCliente: codiceCliente || null,
      indirizzo: indirizzo || null,
      civico: civico || null,
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
      geoStatus,
      assignedUserId: assignedId,
    },
  });

  return NextResponse.json(await clientWithAssignee(updated.id));
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const existing = await getClientForOrg(id, session!.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  const body = await req.json();
  const { lat, lng, icona } = body as {
    lat?: unknown;
    lng?: unknown;
    icona?: unknown;
  };

  const hasCoords = lat !== undefined || lng !== undefined;
  const hasIcona = icona !== undefined;

  if (!hasCoords && !hasIcona) {
    return NextResponse.json(
      { error: "Nessun campo da aggiornare" },
      { status: 400 }
    );
  }

  const data: { lat?: number; lng?: number; icona?: string | null } = {};

  if (hasCoords) {
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: "lat e lng devono essere numeri" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "Coordinate non finite" }, { status: 400 });
    }
    if (lat < 35 || lat > 48 || lng < 5 || lng > 20) {
      return NextResponse.json(
        { error: "Coordinate fuori dall'area Italia prevista" },
        { status: 400 }
      );
    }
    data.lat = lat;
    data.lng = lng;
  }

  if (hasIcona) {
    if (icona !== null && typeof icona !== "string") {
      return NextResponse.json(
        { error: "icona deve essere una stringa o null" },
        { status: 400 }
      );
    }
    data.icona = icona === null || icona === "" ? null : (icona as string).slice(0, 16);
  }

  await prisma.client.update({
    where: { id: existing.id },
    data,
  });

  return NextResponse.json(await clientWithAssignee(existing.id));
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireOperator();
  if (error) return error;

  const { id } = await params;
  const existing = await getClientForOrg(id, session!.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  await prisma.client.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
