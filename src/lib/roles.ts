import type { UserRole } from "@prisma/client";

export type SessionRole = "ADMIN" | "USER" | "TECNICO";

export const ROLE_LABEL: Record<SessionRole, string> = {
  ADMIN: "Admin",
  USER: "Operatore",
  TECNICO: "Tecnico",
};

export function isAdmin(role: string): boolean {
  return role === "ADMIN";
}

/** Admin e operatore: gestione clienti, impianti, interventi, calendario, pianificazione. */
export function canOperate(role: string): boolean {
  return role === "ADMIN" || role === "USER";
}

export function isTechnician(role: string): boolean {
  return role === "TECNICO";
}

export function parseUserRole(raw: unknown): UserRole | null {
  if (raw === "ADMIN" || raw === "USER" || raw === "TECNICO") return raw;
  if (raw === "OPERATORE") return "USER";
  return null;
}

export function technicianDisplayName(user: {
  username: string;
  nome?: string | null;
  cognome?: string | null;
}): string {
  const full = [user.nome, user.cognome].filter(Boolean).join(" ").trim();
  return full || user.username;
}
