import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";

export async function GET() {
  let settings = await prisma.settings.findUnique({ where: { id: "default" } });

  if (!settings) {
    // Crea settings di default: Via San Giorgio 14, Cavallermaggiore
    settings = await prisma.settings.create({
      data: {
        id: "default",
        startLat: 44.7089,
        startLng: 7.6617,
        startLabel: "Via San Giorgio 14, Cavallermaggiore",
      },
    });
  }

  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { startLabel } = body;

  let startLat = body.startLat;
  let startLng = body.startLng;

  // Se viene fornito solo il label, geocodifica
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
    where: { id: "default" },
    update: { startLat, startLng, startLabel },
    create: {
      id: "default",
      startLat,
      startLng,
      startLabel,
    },
  });

  return NextResponse.json(settings);
}
