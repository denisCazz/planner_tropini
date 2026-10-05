import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { personName, clientAddress, buildMapsUrl, navigateUrl } from "@/lib/share";
import { telHref } from "@/lib/phone";
import { formatItalianDateLong } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PublicPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const plan = await prisma.plan.findUnique({
    where: { publicToken: token },
    include: {
      technician: true,
      stops: { include: { client: true }, orderBy: [{ ordine: "asc" }, { score: "desc" }] },
    },
  });
  if (!plan) notFound();
  const settings = await prisma.settings.findUnique({ where: { organizationId: plan.organizationId } });
  const ordered = plan.stops.filter((s) => s.ordine != null && s.status !== "NON_DISPONIBILE");
  const stops = ordered.length > 0 ? ordered : plan.stops.filter((s) => s.status !== "NON_DISPONIBILE");
  const maps = settings
    ? buildMapsUrl({ lat: settings.startLat, lng: settings.startLng }, stops)
    : buildMapsUrl(null, stops);

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <p className="text-sm text-teal-700 font-semibold">{settings?.companyName ?? "Tropini"}</p>
      <h1 className="text-2xl font-bold mt-1">{formatItalianDateLong(plan.data.toISOString().slice(0, 10))}</h1>
      <p className="text-slate-600 mt-1">
        {personName(plan.technician)} · zona {plan.zona} · {stops.length} tappe
      </p>
      <a href={maps} className="mt-4 inline-block rounded-xl bg-teal-700 text-white px-4 py-2 text-sm font-medium">
        Apri percorso
      </a>
      <ol className="mt-6 space-y-3">
        {stops.map((s, i) => (
          <li key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="font-semibold">
              {s.ordine ?? i + 1}. {s.orario ? `${s.orario} · ` : ""}
              {personName(s.client)}
            </div>
            <div className="text-sm text-slate-500">{clientAddress(s.client)}</div>
            <div className="mt-2 flex gap-3 text-sm">
              {(s.client.telefono || s.client.telefono2) && (
                <a className="text-teal-700 font-medium" href={telHref(s.client.telefono || s.client.telefono2)}>
                  Chiama
                </a>
              )}
              <a className="text-teal-700 font-medium" href={navigateUrl(s.client)}>
                Naviga
              </a>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
