import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";
import { requireSession } from "@/lib/tenant";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  let settings = await prisma.settings.findUnique({
    where: { organizationId: session!.organizationId },
  });

  if (!settings) {
    settings = await prisma.settings.create({
      data: { organizationId: session!.organizationId },
    });
  }

  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const { startLabel, nearestNeighbours: nnRaw } = body;

  let startLat = body.startLat;
  let startLng = body.startLng;

  let nearestNeighbours: number | undefined;
  if (nnRaw !== undefined && nnRaw !== null) {
    const n = Number(nnRaw);
    if (!Number.isInteger(n) || n < 1 || n > 20) {
      return NextResponse.json(
        { error: "nearestNeighbours deve essere un intero tra 1 e 20" },
        { status: 400 }
      );
    }
    nearestNeighbours = n;
  }

  if (startLabel && (startLat === undefined || startLng === undefined)) {
    const geo = await geocodeAddress(startLabel);
    if (!geo) {
      return NextResponse.json(
        { error: "Indirizzo non trovato" },
        { status: 400 }
      );
    }
    startLat = geo.lat;
    startLng = geo.lng;
  }

  const settings = await prisma.settings.upsert({
    where: { organizationId: session!.organizationId },
    update: {
      ...(startLat !== undefined && { startLat }),
      ...(startLng !== undefined && { startLng }),
      ...(startLabel !== undefined && { startLabel }),
      ...(nearestNeighbours !== undefined && { nearestNeighbours }),
    },
    create: {
      organizationId: session!.organizationId,
      startLat: startLat ?? 44.7089,
      startLng: startLng ?? 7.6617,
      startLabel: startLabel ?? "Via San Giorgio 14, Cavallermaggiore",
      nearestNeighbours: nearestNeighbours ?? 4,
    },
  });

  return NextResponse.json(settings);
}
