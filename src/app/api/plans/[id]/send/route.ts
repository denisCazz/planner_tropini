import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/tenant";
import { appBaseUrl, getPlan, orgSettings } from "@/lib/planner";
import { buildMapsUrl, buildPlanEmailHtml, buildPlanText } from "@/lib/share";
import { sendEmail } from "@/lib/mailer";
import { sendSms } from "@/lib/twilio";
import { toE164 } from "@/lib/phone";
import { formatItalianDateLong } from "@/lib/dates";

type Channel = "email" | "sms" | "whatsapp";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireOperator();
  if (error || !session) return error;
  const { id } = await params;
  const { channels = ["email"] } = (await req.json().catch(() => ({}))) as { channels?: Channel[] };
  const plan = await getPlan(Number(id), session.organizationId);
  if (!plan) return NextResponse.json({ error: "Piano non trovato" }, { status: 404 });
  const stops = plan.stops.filter((s) => s.status !== "NON_DISPONIBILE" && s.ordine != null);
  if (stops.length === 0) return NextResponse.json({ error: "Crea prima il percorso" }, { status: 400 });

  const settings = await orgSettings(session.organizationId);
  const start = { lat: settings.startLat, lng: settings.startLng };
  const page = `${appBaseUrl(req.url)}/p/${plan.publicToken}`;
  const maps = buildMapsUrl(start, stops);
  const text = buildPlanText(plan, stops, { maps, page });
  const done: string[] = [];
  const errors: string[] = [];
  let whatsappUrl: string | null = null;
  const who = `${plan.technician.cognome ?? ""} ${plan.technician.nome ?? ""}`.trim() || plan.technician.username;

  if (channels.includes("email")) {
    if (!plan.technician.email) errors.push(`${who} non ha un'email. Aggiungila in Tecnici.`);
    else {
      try {
        await sendEmail({
          to: plan.technician.email,
          subject: `Giro ${formatItalianDateLong(plan.data.toISOString().slice(0, 10))} · zona ${plan.zona}`,
          html: buildPlanEmailHtml(plan, stops, { maps, page }, settings.companyName),
          text,
        });
        done.push("email");
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "Errore email");
      }
    }
  }
  if (channels.includes("sms")) {
    const to = toE164(plan.technician.telefono);
    if (!to) errors.push(`${who} non ha un telefono`);
    else {
      try {
        await sendSms(to, `Giro ${formatItalianDateLong(plan.data.toISOString().slice(0, 10))}: ${stops.length} tappe zona ${plan.zona}. ${page}`);
        done.push("sms");
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "Errore SMS");
      }
    }
  }
  if (channels.includes("whatsapp")) {
    const phone = toE164(plan.technician.telefono)?.replace("+", "") ?? "";
    whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    done.push("whatsapp");
  }
  if (done.length > 0) {
    await prisma.plan.update({ where: { id: plan.id }, data: { status: "INVIATO", sentAt: new Date() } });
  }
  return NextResponse.json({ done, errors, whatsappUrl, plan: await getPlan(plan.id, session.organizationId) });
}
