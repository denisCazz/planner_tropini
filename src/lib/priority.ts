const DAY = 86_400_000;

export function scoreClient(
  client: { urgente: boolean; stato: string; ultimaVisita: Date | null },
  distanzaKm: number,
  raggioKm: number,
  refDate: Date
) {
  let score = 0;
  const motivi: string[] = [];
  if (client.urgente) {
    score += 100;
    motivi.push("Urgente");
  }
  if (client.stato === "ATTIVO") {
    score += 30;
    motivi.push("Cliente attivo");
  } else if (client.stato === "PROSPECT") score += 10;

  if (!client.ultimaVisita) {
    score += 40;
    motivi.push("Mai visitato");
  } else {
    const days = (refDate.getTime() - client.ultimaVisita.getTime()) / DAY;
    if (days < 60) {
      score -= 50;
      motivi.push(`Visitato ${Math.max(0, Math.round(days))} gg fa`);
    } else {
      const months = Math.round(days / 30);
      score += Math.min(60, months * 4);
      motivi.push(`Ultima visita ${months} mesi fa`);
    }
  }
  score -= (distanzaKm / Math.max(raggioKm, 1)) * 15;
  return { score: Math.round(score * 10) / 10, distanzaKm: Math.round(distanzaKm * 10) / 10, motivi };
}
