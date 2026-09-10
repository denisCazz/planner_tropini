import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildClientAddress, geocodeAddress, nominatimDelayMs } from "@/lib/geocode";
import { requireSession, requireOperator, orgScope } from "@/lib/tenant";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const missingCoords = {
  OR: [{ lat: null }, { lng: null }],
};

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const org = orgScope(session!.organizationId);
  const candidates = await prisma.client.findMany({
    where: { ...org, ...missingCoords },
    select: {
      indirizzo: true,
      cap: true,
      citta: true,
      provincia: true,
    },
  });

  let pending = 0;
  let noAddress = 0;
  for (const c of candidates) {
    if (buildClientAddress(c)) pending++;
    else noAddress++;
  }

  return NextResponse.json({ pending, noAddress, total: candidates.length });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireOperator();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(
    Math.max(parseInt(String(body.batchSize ?? "5"), 10) || 5, 1),
    10
  );
  const excludeIds = Array.isArray(body.excludeIds)
    ? body.excludeIds
        .map((id: unknown) => Number(id))
        .filter((n: number) => Number.isInteger(n) && n > 0)
    : [];

  const org = orgScope(session!.organizationId);
  const clients = await prisma.client.findMany({
    where: {
      ...org,
      ...missingCoords,
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
    },
    select: {
      id: true,
      indirizzo: true,
      cap: true,
      citta: true,
      provincia: true,
    },
    orderBy: { id: "asc" },
    take: batchSize * 3,
  });

  let geocoded = 0;
  let failed = 0;
  let skipped = 0;
  let processed = 0;
  const failedIds: number[] = [];

  for (const client of clients) {
    if (processed >= batchSize) break;

    const address = buildClientAddress(client);
    if (!address) {
      skipped++;
      continue;
    }

    processed++;
    const geo = await geocodeAddress(address);
    if (!geo) {
      failed++;
      failedIds.push(client.id);
    } else {
      await prisma.client.update({
        where: { id: client.id },
        data: { lat: geo.lat, lng: geo.lng },
      });
      geocoded++;
    }

    if (processed < batchSize) {
      await sleep(nominatimDelayMs());
    }
  }

  const remainingRows = await prisma.client.findMany({
    where: {
      ...org,
      ...missingCoords,
      ...(excludeIds.length || failedIds.length
        ? { id: { notIn: [...excludeIds, ...failedIds] } }
        : {}),
    },
    select: {
      indirizzo: true,
      cap: true,
      citta: true,
      provincia: true,
    },
  });

  let remaining = 0;
  for (const c of remainingRows) {
    if (buildClientAddress(c)) remaining++;
  }

  return NextResponse.json({
    geocoded,
    failed,
    skipped,
    processed,
    remaining,
    failedIds,
  });
}
