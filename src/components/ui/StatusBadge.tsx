"use client";

import { STATO_META } from "@/lib/status";
import type { StatoIntervento, PrioritaIntervento } from "@/types/client";
import { PRIORITA_META } from "@/lib/status";

export function StatusBadge({ stato }: { stato: StatoIntervento }) {
  const meta = STATO_META[stato];
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.text}`}
      title={meta.label}
    >
      <span aria-hidden>{meta.glyph}</span>
      {meta.short}
    </span>
  );
}

export function PriorityBadge({ priorita }: { priorita: PrioritaIntervento }) {
  const meta = PRIORITA_META[priorita];
  if (!meta) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.text}`}>
      {meta.label}
    </span>
  );
}
