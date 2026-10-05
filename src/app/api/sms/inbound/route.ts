import { NextRequest } from "next/server";
import { handleInboundSms, appBaseUrl } from "@/lib/planner";
import { validateTwilioSignature } from "@/lib/twilio";

const REPLY: Record<string, string> = {
  CONFERMA: "Grazie, appuntamento confermato!",
  RIFIUTO: "Grazie per averci avvisato, la ricontatteremo.",
};

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));
  const url = `${appBaseUrl(req.url)}/api/sms/inbound`;
  if (process.env.TWILIO_SKIP_SIGNATURE !== "1" && !validateTwilioSignature(url, params, req.headers.get("x-twilio-signature"))) {
    return new Response("Invalid signature", { status: 403 });
  }
  const { intent } = await handleInboundSms(params.From ?? "", params.To ?? "", params.Body ?? "", params.MessageSid);
  const msg = REPLY[intent];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg}</Message>` : ""}</Response>`;
  return new Response(xml, { headers: { "Content-Type": "text/xml" } });
}
