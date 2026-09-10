/**
 * Architettura per la futura funzione SUGERISCI GIORNATA.
 *
 * Input: tecnico + data.
 * Output: giornata consigliata (fermate ordinate) modificabile dall'operatore.
 *
 * Vincoli da considerare in una implementazione successiva:
 * - posizione / raggruppamento geografico
 * - disponibilità cliente
 * - durata interventi
 * - appuntamenti già presenti
 * - competenze tecnico (non ancora modellate)
 * - distanza e finestre temporali
 * - priorità
 *
 * Non implementa un algoritmo VRP: restituisce solo la struttura e i vincoli raccolti.
 */

export type SuggestDayInput = {
  organizationId: string;
  technicianId: string;
  date: string; // YYYY-MM-DD
};

export type SuggestDayStop = {
  interventoId: number;
  clientId: number;
  startMin: number;
  durationMin: number;
  reason: string;
};

export type SuggestDayResult = {
  ready: false;
  technicianId: string;
  date: string;
  message: string;
  constraints: {
    existingAppointments: number;
    availableCandidates: number;
    confirmedCandidates: number;
    toPlanNearby: number;
  };
  suggestedStops: SuggestDayStop[];
};

export function emptySuggestion(
  input: SuggestDayInput,
  constraints: SuggestDayResult["constraints"]
): SuggestDayResult {
  return {
    ready: false,
    technicianId: input.technicianId,
    date: input.date,
    message:
      "Suggerimento automatico non ancora attivo. Usa la pianificazione manuale: i candidati e gli appuntamenti esistenti sono già disponibili.",
    constraints,
    suggestedStops: [],
  };
}
