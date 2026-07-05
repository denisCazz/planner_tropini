/** Preset di icone rapide per i marker della mappa.
 *  Il valore salvato in Client.icona è direttamente l'emoji (o null = pin di stato). */
export interface MapIconPreset {
  emoji: string;
  label: string;
}

export const MAP_ICON_PRESETS: MapIconPreset[] = [
  { emoji: "⭐", label: "Importante" },
  { emoji: "🔥", label: "Caldo" },
  { emoji: "🔧", label: "Assistenza" },
  { emoji: "💰", label: "Vendita" },
  { emoji: "📞", label: "Da chiamare" },
  { emoji: "✅", label: "Fatto" },
  { emoji: "🚩", label: "Priorità" },
  { emoji: "📦", label: "Consegna" },
];

export function isPresetIcon(value: string | null | undefined): boolean {
  if (!value) return false;
  return MAP_ICON_PRESETS.some((p) => p.emoji === value);
}
