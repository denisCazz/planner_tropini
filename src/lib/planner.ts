import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { geocodeZone, haversineKm } from "./geo";
import { scoreClient } from "./priority";
import { addDaysToDateKey, formatItalianDateLong, hhmmToMinutes, minutesToHHMM, parseDateKey, toLocalDateKey } from "./dates";
import { optimizeRoute, getRouteGeometry } from "./ors";
import { bestMobile } from "./phone";
import { sendSms } from "./twilio";
import { aiConfigured, classifySmsReply, type ParsedAssignment, type SmsIntent } from "./plan-parse";
import { personName } from "./share";

export const PLAN_INCLUDE = {
  technician: { select: { id: true, nome: true, cognome: true, username: true, email: true, telefono: true } },
  stops: {
    include: {
      client: true,
      messages: { orderBy: { createdAt: "desc" as const }, take: 5 },
    },
    orderBy: [{ ordine: "asc" as const }, { score: "desc" as const }],
  },
} satisfies Prisma.PlanInclude;

const DEFAULT_RADIUS = 12;
const MAX_RADIUS = 35;
const SERVICE_MIN = 45;
const DAY_START = "08:30";
const ROAD_KMH = 40;

export class PlanLockedError extends Error {
  constructor() {
    super("Giornata già confermata");
    this.name = "PlanLockedError";
  }
}

export function planIsLocked(status: string) {
  return status === "PRONTO" || status === "INVIATO";
}

function dateKeyOf(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function relativeGiorno(d: Date) {
  const key = dateKeyOf(d);
  const today = toLocalDateKey(new Date());
  if (key === today) return "oggi";
  if (key === addDaysToDateKey(today, 1)) return "domani";
  return formatItalianDateLong(key);
}

function normName(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function orgSettings(organizationId: string) {
  return prisma.settings.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId },
  });
}

async function busyClientIds(organizationId: string, data: Date) {
  const [stops, appointments] = await Promise.all([
    prisma.planStop.findMany({
      where: { status: { not: "NON_DISPONIBILE" }, plan: { organizationId, data } },
      select: { clientId: true },
    }),
    prisma.appointment.findMany({
      where: { organizationId, date: data, stato: { not: "ANNULLATO" } },
      select: { clientId: true },
    }),
  ]);
  return new Set([...stops.map((r) => r.clientId), ...appointments.map((r) => r.clientId)]);
}

type HoursSlot = { day?: number; start?: string };

function dayStartFor(workingHours: unknown, data: Date) {
  if (!Array.isArray(workingHours)) return DAY_START;
  const js = data.getUTCDay();
  const day = js === 0 ? 7 : js;
  const slot = workingHours.find((s): s is HoursSlot => {
    if (!s || typeof s !== "object") return false;
    const row = s as HoursSlot;
    return row.day === day && typeof row.start === "string" && hhmmToMinutes(row.start) != null;
  });
  return slot?.start ?? DAY_START;
}

async function departure(organizationId: string, technicianId: string, data: Date) {
  const [settings, tech] = await Promise.all([
    orgSettings(organizationId),
    prisma.user.findFirst({
      where: { id: technicianId, organizationId },
      select: { startLat: true, startLng: true, startLabel: true, workingHours: true },
    }),
  ]);
  const hasOwn = tech?.startLat != null && tech.startLng != null;
  return {
    lat: hasOwn ? tech.startLat! : settings.startLat,
    lng: hasOwn ? tech.startLng! : settings.startLng,
    label: tech?.startLabel?.trim() || settings.startLabel,
    dayStart: dayStartFor(tech?.workingHours, data),
  };
}

export async function findCandidates(opts: {
  organizationId: string;
  lat: number;
  lng: number;
  raggioKm: number;
  data: Date;
  exclude?: Set<number>;
  needed: number;
  /** Distanza mostrata: parte da del tecnico, se diversa dal centro zona. */
  fromLat?: number;
  fromLng?: number;
}) {
  const busy = await busyClientIds(opts.organizationId, opts.data);
  const exclude = new Set([...busy, ...(opts.exclude ?? [])]);
  const dLat = MAX_RADIUS / 111;
  const dLng = MAX_RADIUS / (111 * Math.cos((opts.lat * Math.PI) / 180));
  const pool = await prisma.client.findMany({
    where: {
      organizationId: opts.organizationId,
      stato: { not: "INATTIVO" },
      lat: { gte: opts.lat - dLat, lte: opts.lat + dLat },
      lng: { gte: opts.lng - dLng, lte: opts.lng + dLng },
    },
  });
  const fromLat = opts.fromLat ?? opts.lat;
  const fromLng = opts.fromLng ?? opts.lng;
  const withDist = pool
    .filter((c) => !exclude.has(c.id) && c.lat != null && c.lng != null)
    .map((c) => ({
      c,
      d: haversineKm(opts.lat, opts.lng, c.lat!, c.lng!),
      fromStart: haversineKm(fromLat, fromLng, c.lat!, c.lng!),
    }));

  let radius = opts.raggioKm;
  let inRange = withDist.filter((x) => x.d <= radius);
  while (inRange.length < opts.needed && radius < MAX_RADIUS) {
    radius = Math.min(MAX_RADIUS, radius * 1.5);
    inRange = withDist.filter((x) => x.d <= radius);
  }
  const candidates = inRange
    .map((x) => {
      const scored = scoreClient(x.c, x.d, radius, opts.data);
      return { client: x.c, ...scored, distanzaKm: Math.round(x.fromStart * 10) / 10 };
    })
    .sort((a, b) => b.score - a.score || a.distanzaKm - b.distanzaKm);
  return { candidates, raggioKm: Math.round(radius) };
}

async function matchTechnician(organizationId: string, name: string) {
  const users = await prisma.user.findMany({ where: { organizationId, attivo: true } });
  const n = normName(name);
  return (
    users.find((u) => normName(personName(u)) === n) ??
    users.find((u) => normName(u.nome ?? "") === n || normName(u.username) === n) ??
    users.find((u) => normName(personName(u)).includes(n) || n.includes(normName(u.nome ?? "___"))) ??
    null
  );
}

export async function technicianNames(organizationId: string) {
  const users = await prisma.user.findMany({
    where: { organizationId, attivo: true },
    select: { nome: true, cognome: true, username: true },
  });
  return users.map((u) => personName(u));
}

export async function createPlans(organizationId: string, assignments: ParsedAssignment[]) {
  const warnings: string[] = [];
  const planIds: number[] = [];
  const batchId = crypto.randomUUID();
  const usedByDay = new Map<string, Set<number>>();

  for (const a of assignments) {
    const data = parseDateKey(a.data);
    if (!data) {
      warnings.push(`Data non valida per ${a.operatore}: ${a.data}`);
      continue;
    }
    const zone = await geocodeZone(a.zona);
    if (!zone) {
      warnings.push(`Zona "${a.zona}" non trovata`);
      continue;
    }
    const technician = await matchTechnician(organizationId, a.operatore);
    if (!technician) {
      warnings.push(`Tecnico "${a.operatore}" non trovato. Aggiungilo in Tecnici e riprova.`);
      continue;
    }
    const numero = Math.max(1, Math.min(20, Number(a.numeroClienti) || 5));
    const usedToday = usedByDay.get(a.data) ?? new Set<number>();
    const home = await departure(organizationId, technician.id, data);
    const { candidates, raggioKm } = await findCandidates({
      organizationId,
      lat: zone.lat,
      lng: zone.lng,
      fromLat: home.lat,
      fromLng: home.lng,
      raggioKm: DEFAULT_RADIUS,
      data,
      exclude: usedToday,
      needed: numero,
    });
    const chosen = candidates.slice(0, numero);
    if (chosen.length < numero) {
      warnings.push(`${personName(technician)} ${relativeGiorno(data)}: trovati ${chosen.length}/${numero} clienti entro ${raggioKm} km da ${zone.label}`);
    }
    chosen.forEach((c) => usedToday.add(c.client.id));
    usedByDay.set(a.data, usedToday);

    const plan = await prisma.plan.create({
      data: {
        organizationId,
        batchId,
        data,
        technicianId: technician.id,
        zona: zone.label,
        zonaLat: zone.lat,
        zonaLng: zone.lng,
        raggioKm,
        numeroClienti: numero,
        note: a.note || null,
        status: "CONFERMA",
        publicToken: crypto.randomBytes(12).toString("base64url"),
        stops: {
          create: chosen.map((c) => ({
            clientId: c.client.id,
            score: c.score,
            distanzaKm: c.distanzaKm,
            motivo: c.motivi.join(" · ") || null,
          })),
        },
      },
    });
    planIds.push(plan.id);
  }
  return { batchId, planIds, warnings };
}

export function getPlan(id: number, organizationId: string) {
  return prisma.plan.findFirst({ where: { id, organizationId }, include: PLAN_INCLUDE });
}

export async function planCandidates(planId: number, organizationId: string, limit = 8) {
  const plan = await prisma.plan.findFirst({ where: { id: planId, organizationId }, include: { stops: true } });
  if (!plan) return [];
  const home = await departure(organizationId, plan.technicianId, plan.data);
  const { candidates } = await findCandidates({
    organizationId,
    lat: plan.zonaLat,
    lng: plan.zonaLng,
    fromLat: home.lat,
    fromLng: home.lng,
    raggioKm: plan.raggioKm,
    data: plan.data,
    exclude: new Set(plan.stops.map((s) => s.clientId)),
    needed: limit,
  });
  return candidates.slice(0, limit);
}

async function invalidateRoute(planId: number) {
  await prisma.plan.updateMany({
    where: { id: planId, status: { in: ["PRONTO", "INVIATO"] } },
    data: { status: "CONFERMA", geometry: Prisma.DbNull, totalDistance: null, totalDuration: null },
  });
}

export async function addStop(planId: number, organizationId: string, clientId?: number, motivoPrefix?: string) {
  const plan = await prisma.plan.findFirst({ where: { id: planId, organizationId } });
  if (!plan) return null;
  if (planIsLocked(plan.status)) throw new PlanLockedError();
  let pick: { client: { id: number; cognome: string; nome: string }; score: number; distanzaKm: number; motivi: string[] } | undefined;
  if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, organizationId } });
    if (!client) return null;
    const d = client.lat != null && client.lng != null ? haversineKm(plan.zonaLat, plan.zonaLng, client.lat, client.lng) : 0;
    pick = { client, ...scoreClient(client, d, plan.raggioKm, plan.data) };
  } else {
    pick = (await planCandidates(planId, organizationId, 1))[0];
  }
  if (!pick) return null;
  await prisma.planStop.create({
    data: {
      planId,
      clientId: pick.client.id,
      score: pick.score,
      distanzaKm: pick.distanzaKm,
      motivo: [motivoPrefix, ...pick.motivi].filter(Boolean).join(" · ") || null,
    },
  });
  await invalidateRoute(planId);
  return pick;
}

export async function markUnavailable(stopId: number, organizationId: string, replace = true) {
  const stop = await prisma.planStop.findFirst({
    where: { id: stopId, plan: { organizationId } },
    include: { client: true, plan: true },
  });
  if (!stop) return null;
  await prisma.planStop.update({ where: { id: stopId }, data: { status: "NON_DISPONIBILE", ordine: null } });
  await invalidateRoute(stop.planId);
  if (!replace) return { replacement: null };
  const replacement = await addStop(stop.planId, organizationId, undefined, `Sostituisce ${personName(stop.client)}`);
  return { replacement };
}

function hhmmToSec(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 3600 + m * 60;
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function orderNearest<T extends { client: { lat: number | null; lng: number | null } }>(
  start: { lat: number; lng: number },
  stops: T[]
) {
  const left = [...stops];
  const ordered: T[] = [];
  let lat = start.lat;
  let lng = start.lng;
  while (left.length) {
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < left.length; i++) {
      const c = left[i].client;
      const d = c.lat != null && c.lng != null ? haversineKm(lat, lng, c.lat, c.lng) : 10_000 + i;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const next = left.splice(best, 1)[0];
    ordered.push(next);
    if (next.client.lat != null && next.client.lng != null) {
      lat = next.client.lat;
      lng = next.client.lng;
    }
  }
  return ordered;
}

async function publishAppointments(planId: number, organizationId: string) {
  const plan = await prisma.plan.findFirst({
    where: { id: planId, organizationId },
    include: { stops: true },
  });
  if (!plan) return;
  const active = plan.stops
    .filter((s) => s.status !== "NON_DISPONIBILE" && s.ordine != null)
    .sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0));
  await prisma.appointment.deleteMany({
    where: { organizationId, note: { startsWith: `giro:${planId}:` } },
  });
  if (active.length === 0) return;
  await prisma.appointment.createMany({
    data: active.map((s, i) => ({
      organizationId,
      clientId: s.clientId,
      technicianId: plan.technicianId,
      date: plan.data,
      startMin: hhmmToMinutes(s.orario ?? "") ?? 8 * 60 + 30 + i * SERVICE_MIN,
      durationMin: SERVICE_MIN,
      stato: s.status === "CONFERMATO" ? "CONFERMATO" : "PIANIFICATO",
      tipo: "MANUTENZIONE" as const,
      note: `giro:${planId}:${s.id}`,
    })),
  });
}

function scheduleFromDeparture<T extends { client: { lat: number | null; lng: number | null }; orario?: string | null }>(
  start: { lat: number; lng: number },
  ordered: T[],
  dayStartMin: number
) {
  let cursor = dayStartMin;
  let prev = start;
  for (const stop of ordered) {
    const c = stop.client;
    if (c.lat != null && c.lng != null) {
      const km = haversineKm(prev.lat, prev.lng, c.lat, c.lng);
      cursor += Math.max(5, Math.round((km / ROAD_KMH) * 60));
      prev = { lat: c.lat, lng: c.lng };
    }
    const rounded = Math.round(cursor / 15) * 15;
    stop.orario = minutesToHHMM(rounded);
    cursor = rounded + SERVICE_MIN;
  }
}

export async function optimizePlan(planId: number, organizationId: string) {
  const plan = await prisma.plan.findFirst({ where: { id: planId, organizationId }, include: PLAN_INCLUDE });
  if (!plan) throw new Error("Piano non trovato");
  if (planIsLocked(plan.status)) throw new PlanLockedError();
  const home = await departure(organizationId, plan.technicianId, plan.data);
  const start = { lat: home.lat, lng: home.lng };
  const dayStartMin = hhmmToMinutes(home.dayStart) ?? hhmmToMinutes(DAY_START)!;
  const active = plan.stops.filter((s) => s.status !== "NON_DISPONIBILE");
  if (active.length === 0) throw new Error("Nessuna tappa da mettere in giornata. Tieni almeno un cliente.");

  const withCoords = active.filter((s) => s.client.lat != null && s.client.lng != null);
  let warning: string | null = null;
  let ordered = orderNearest(start, active);
  let geometry: [number, number][] | null = ordered
    .filter((s) => s.client.lat != null && s.client.lng != null)
    .map((s) => [s.client.lat!, s.client.lng!]);
  let totalDistance: number | null = null;
  let totalDuration: number | null = ordered.length * SERVICE_MIN;

  if (withCoords.length > 0) {
    try {
      const opt = await withTimeout(
        optimizeRoute(
          start.lng,
          start.lat,
          withCoords.map((s) => ({ id: s.id, location: [s.client.lng!, s.client.lat!] as [number, number] })),
          { serviceSec: SERVICE_MIN * 60, dayStartSec: hhmmToSec(home.dayStart) }
        ),
        12_000
      );
      const route = opt.routes?.[0];
      const jobSteps = route?.steps.filter((s) => s.type === "job" && s.job !== undefined) ?? [];
      if (!route || jobSteps.length === 0 || (opt.unassigned?.length ?? 0) > 0) {
        warning = `Mappa stradale incompleta: ordine per vicinanza e orari da ${home.dayStart}, con il viaggio fino al primo cliente.`;
      } else {
        const byId = new Map(withCoords.map((s) => [s.id, s]));
        const road = jobSteps.map((s) => byId.get(s.job!)).filter((s): s is (typeof withCoords)[number] => !!s);
        const rest = active.filter((s) => !road.some((r) => r.id === s.id));
        ordered = [...road, ...rest];
        const arrivalById = new Map(jobSteps.map((s) => [s.job!, s.arrival]));
        ordered.forEach((s) => {
          const arrival = arrivalById.get(s.id);
          s.orario = arrival != null ? minutesToHHMM(Math.round(arrival / 60 / 15) * 15) : null;
        });
        const coords: [number, number][] = [
          [start.lng, start.lat],
          ...road.map((s) => [s.client.lng!, s.client.lat!] as [number, number]),
          [start.lng, start.lat],
        ];
        const dir = await withTimeout(getRouteGeometry(coords), 12_000);
        const feature = dir.features?.[0];
        if (feature) {
          geometry = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          totalDistance = Math.round(feature.properties.summary.distance / 100) / 10;
          totalDuration = Math.round(feature.properties.summary.duration / 60);
        }
      }
    } catch {
      warning = `Mappe non raggiungibili: ordine per vicinanza e orari da ${home.dayStart}, con il viaggio fino al primo cliente. La giornata è comunque in calendario.`;
    }
  }

  if (ordered.every((s) => !s.orario)) {
    scheduleFromDeparture(start, ordered, dayStartMin);
  } else {
    let cursor = dayStartMin;
    for (const stop of ordered) {
      if (!stop.orario) stop.orario = minutesToHHMM(Math.round(cursor / 15) * 15);
      cursor = (hhmmToMinutes(stop.orario) ?? cursor) + SERVICE_MIN;
    }
  }

  await prisma.$transaction([
    ...ordered.map((s, i) =>
      prisma.planStop.update({
        where: { id: s.id },
        data: { ordine: i + 1, orario: s.orario, status: "CONFERMATO" },
      })
    ),
    prisma.planStop.updateMany({
      where: { planId, id: { notIn: ordered.map((s) => s.id) } },
      data: { ordine: null },
    }),
    prisma.plan.update({
      where: { id: planId },
      data: {
        geometry: geometry ?? Prisma.DbNull,
        totalDistance,
        totalDuration,
        status: "PRONTO",
      },
    }),
  ]);
  await publishAppointments(planId, organizationId);
  const saved = await getPlan(planId, organizationId);
  return {
    plan: saved,
    warning,
    calendarDate: plan.data.toISOString().slice(0, 10),
  };
}

export async function reopenPlan(planId: number, organizationId: string) {
  const plan = await prisma.plan.findFirst({ where: { id: planId, organizationId } });
  if (!plan) return null;
  await prisma.$transaction([
    prisma.appointment.deleteMany({
      where: { organizationId, note: { startsWith: `giro:${planId}:` } },
    }),
    prisma.plan.update({ where: { id: planId }, data: { status: "CONFERMA" } }),
  ]);
  return getPlan(planId, organizationId);
}

export async function availabilitySmsText(stopId: number, organizationId: string) {
  const stop = await prisma.planStop.findFirst({
    where: { id: stopId, plan: { organizationId } },
    include: { client: true, plan: { include: { technician: true } } },
  });
  if (!stop) return null;
  const settings = await orgSettings(organizationId);
  const giorno = relativeGiorno(stop.plan.data) + (stop.orario ? ` verso le ${stop.orario}` : "");
  const text = settings.smsTemplate
    .replaceAll("{nome}", stop.client.nome || stop.client.cognome)
    .replaceAll("{operatore}", personName(stop.plan.technician))
    .replaceAll("{giorno}", giorno)
    .replaceAll("{azienda}", settings.companyName);
  return { stop, text };
}

export async function sendAvailabilitySms(stopId: number, organizationId: string) {
  const pack = await availabilitySmsText(stopId, organizationId);
  if (!pack) throw new Error("Tappa non trovata");
  const to = bestMobile(pack.stop.client.telefono, pack.stop.client.telefono2);
  if (!to) throw new Error(`${personName(pack.stop.client)}: nessun cellulare`);
  const { sid, from } = await sendSms(to, pack.text);
  await prisma.$transaction([
    prisma.smsMessage.create({
      data: { direction: "OUT", clientId: pack.stop.clientId, stopId, from, to, body: pack.text, providerId: sid },
    }),
    prisma.planStop.update({ where: { id: stopId }, data: { status: "SMS_INVIATO" } }),
  ]);
  return { to, planId: pack.stop.planId };
}

function quickIntent(body: string): SmsIntent | null {
  const t = normName(body).replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (t.split(" ").length > 3) return null;
  if (/^(si|ok|okay|confermo|va bene|certo|perfetto|d accordo)$/.test(t)) return "CONFERMA";
  if (/^(no|non posso|non sono|impossibile|annulla|annullare)$/.test(t)) return "RIFIUTO";
  return null;
}

export async function handleInboundSms(from: string, to: string, body: string, providerId?: string) {
  const lastOut = await prisma.smsMessage.findFirst({
    where: { direction: "OUT", to: from, stopId: { not: null } },
    orderBy: { createdAt: "desc" },
    include: { stop: { include: { plan: true } } },
  });
  let intent: SmsIntent = quickIntent(body) ?? "ALTRO";
  let riassunto = "";
  if (intent === "ALTRO" && aiConfigured()) {
    try {
      const r = await classifySmsReply(body);
      intent = r.intent;
      riassunto = r.riassunto;
    } catch {
      intent = "ALTRO";
    }
  }
  await prisma.smsMessage.create({
    data: { direction: "IN", clientId: lastOut?.clientId ?? null, stopId: lastOut?.stopId ?? null, from, to, body, providerId, intent },
  });
  const org = lastOut?.stop?.plan.organizationId;
  if (!lastOut?.stopId || !org) return { intent, matched: false };
  if (intent === "CONFERMA") {
    await prisma.planStop.update({ where: { id: lastOut.stopId }, data: { status: "CONFERMATO" } });
  } else if (intent === "RIFIUTO") {
    await markUnavailable(lastOut.stopId, org, true);
  } else if (riassunto) {
    const stop = await prisma.planStop.findUnique({ where: { id: lastOut.stopId } });
    if (stop) {
      await prisma.planStop.update({
        where: { id: stop.id },
        data: { note: [stop.note, `SMS: ${riassunto}`].filter(Boolean).join("\n") },
      });
    }
  }
  return { intent, matched: true };
}

export function appBaseUrl(reqUrl?: string) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  return reqUrl ? new URL(reqUrl).origin : "";
}

export { orgSettings };
