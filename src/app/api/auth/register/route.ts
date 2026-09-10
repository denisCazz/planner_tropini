import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "La registrazione è disabilitata. Gli utenti si creano dall'area Tecnici." },
    { status: 403 }
  );
}
