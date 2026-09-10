import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";
import { requireSession, requireOperator, orgScope } from "@/lib/tenant";
import { resolveAssignedUser, INVALID_ASSIGNEE } from "@/lib/tenant";
import type { StatoCliente } from "@/types/client";
import { clientSearchWhere, rankClientMatch } from "@/lib/search";

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const stato = searchParams.get("stato") as StatoCliente | null;
  const search = searchParams.get("search") ?? "";
  const slim = searchParams.get("slim") === "1";
  const hasCoords = searchParams.get("hasCoords") === "1";
  const urgente = searchParams.get("urgente") === "1";
  const assignedTo = searchParams.get("assignedTo"); // userId | "none" | null
  const parsedLimit = parseInt(searchParams.get("limit") ?? (slim ? "80" : "150"), 10);
  const limit = Math.min(Math.max(Number.isNaN(parsedLimit) ? 80 : parsedLimit, 1), 5000);

  const where: Prisma.ClientWhereInput = {
    ...orgScope(session!.organizationId),
    ...(stato ? { stato } : {}),
    ...(urgente ? { urgente: true } : {}),
    ...(hasCoords ? { lat: { not: null }, lng: { not: null } } : {}),
    ...(assignedTo
      ? { assignedUserId: assignedTo === "none" ? null : assignedTo }
      : {}),
    ...clientSearchWhere(search),
  };

  const slimSelect = {
    id: true,
    nome: true,
    cognome: true,
    ragioneSociale: true,
    telefono: true,
    telefono2: true,
    indirizzo: true,
    cap: true,
    citta: true,
    stato: true,
    urgente: true,
    icona: true,
    marcaStufa: true,
    modelloStufa: true,
    ultimaVisita: true,
    lat: true,
    lng: true,
    assignedUserId: true,
    assignedUser: { select: { username: true } },
  } as const;

  const fetchLimit = search.trim() ? Math.min(Math.max(limit * 3, 80), 2000) : limit;

  if (slim) {
    const [rows, total] = await Promise.all([
      prisma.client.findMany({
        where,
        select: slimSelect,
        orderBy: [{ cognome: "asc" }, { nome: "asc" }],
        take: fetchLimit,
      }),
      prisma.client.count({ where }),
    ]);
    const items = rows.map(({ assignedUser, ...c }) => ({
      ...c,
      assignedUserName: assignedUser?.username ?? null,
    }));
    if (search.trim()) {
      items.sort(
        (a, b) =>
          rankClientMatch(a, search) - rankClientMatch(b, search) ||
          a.cognome.localeCompare(b.cognome, "it") ||
          a.nome.localeCompare(b.nome, "it")
      );
      items.splice(limit);
    }
    return NextResponse.json({ items, total, limit });
  }

  const [rows, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: { assignedUser: { select: { username: true } } },
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
      take: fetchLimit,
    }),
    prisma.client.count({ where }),
  ]);
  let clients = rows.map(({ assignedUser, ...c }) => ({
    ...c,
    assignedUserName: assignedUser?.username ?? null,
  }));
  if (search.trim()) {
    clients.sort(
      (a, b) =>
        rankClientMatch(a, search) - rankClientMatch(b, search) ||
        a.cognome.localeCompare(b.cognome, "it") ||
        a.nome.localeCompare(b.nome, "it")
    );
    clients = clients.slice(0, limit);
  }

  return NextResponse.json(clients, {
    headers: { "X-Total-Count": String(total) },
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireOperator();
  if (error) return error;

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

  if (!nome) {
    return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
  }

  const assignedId = await resolveAssignedUser(assignedUserId, session!.organizationId);
  if (assignedId === INVALID_ASSIGNEE) {
    return NextResponse.json({ error: "Tecnico non valido" }, { status: 400 });
  }

  let lat: number | null = null;
  let lng: number | null = null;
  let geoStatus: string = "missing";

  const street = [indirizzo, civico].filter(Boolean).join(" ");
  if (street || citta) {
    const query = [street, cap, citta, provincia].filter(Boolean).join(", ");
    const geo = await geocodeAddress(query);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      geoStatus = "ok";
    } else {
      geoStatus = "not_found";
    }
  }

  const client = await prisma.client.create({
    data: {
      organizationId: session!.organizationId,
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
      stato: stato ?? "PROSPECT",
      urgente: urgente ?? false,
      ultimaVisita: ultimaVisita ? new Date(ultimaVisita) : null,
      lat,
      lng,
      geoStatus,
      assignedUserId: assignedId,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
