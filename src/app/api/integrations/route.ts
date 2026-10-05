import { NextResponse } from "next/server";
import { requireSession } from "@/lib/tenant";
import { aiConfigured } from "@/lib/ai";
import { twilioConfigured } from "@/lib/twilio";
import { resendConfigured } from "@/lib/mailer";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;
  return NextResponse.json({
    openai: aiConfigured(),
    twilio: twilioConfigured(),
    resend: resendConfigured(),
    ors: !!process.env.ORS_API_KEY,
    appUrl: process.env.APP_URL ?? null,
  });
}
