import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";
import { requireAdmin, requireSession } from "@/lib/tenant";
import { unauthorizedResponse } from "@/lib/auth";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const org = await prisma.organization.findUnique({
    where: { id: session!.organizationId },
    select: { id: true },
  });
  if (!org) return unauthorizedResponse();

  const settings = await prisma.settings.upsert({
    where: { organizationId: session!.organizationId },
    update: {},
    create: { organizationId: session!.organizationId },
  });

  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { startLabel, nearestNeighbours: nnRaw, companyName, smsTemplate } = body;

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

  let consumoL100: number | undefined;
  if (body.consumoL100 !== undefined && body.consumoL100 !== null && body.consumoL100 !== "") {
    const n = Number(body.consumoL100);
    if (!Number.isFinite(n) || n <= 0 || n > 40) {
      return NextResponse.json({ error: "Consumo non valido (litri/100 km)" }, { status: 400 });
    }
    consumoL100 = n;
  }

  let fuelPriceUpdate: { fuelPrice: number | null; fuelPriceAt: Date | null } | undefined;
  if (body.fuelPrice === null || body.fuelPrice === "") {
    fuelPriceUpdate = { fuelPrice: null, fuelPriceAt: null };
  } else if (body.fuelPrice !== undefined) {
    const n = Number(body.fuelPrice);
    if (!Number.isFinite(n) || n <= 0 || n > 6) {
      return NextResponse.json({ error: "Prezzo carburante non valido" }, { status: 400 });
    }
    fuelPriceUpdate = { fuelPrice: n, fuelPriceAt: new Date() };
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
      ...(typeof companyName === "string" && companyName.trim() && { companyName: companyName.trim() }),
      ...(typeof smsTemplate === "string" && smsTemplate.trim() && { smsTemplate: smsTemplate.trim() }),
      ...(typeof body.fuelType === "string" && body.fuelType.trim() && { fuelType: body.fuelType.trim() }),
      ...(consumoL100 !== undefined && { consumoL100 }),
      ...(fuelPriceUpdate !== undefined && fuelPriceUpdate),
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
