import { getSession, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { canOperate, isTechnician } from "@/lib/roles";
import type { SessionPayload } from "@/lib/auth";

export async function requireSession() {
  const session = await getSession();
  if (!session) return { session: null, error: unauthorizedResponse() };
  return { session, error: null };
}

export async function requireAdmin() {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (session!.role !== "ADMIN") {
    return { session: null, error: forbiddenResponse() };
  }
  return { session, error: null };
}

/** Admin e operatore (non tecnico). */
export async function requireOperator() {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (!canOperate(session!.role)) {
    return { session: null, error: forbiddenResponse() };
  }
  return { session, error: null };
}

/** Se il ruolo è tecnico, limita le query ai propri record. */
export function ownTechnicianFilter(session: SessionPayload): { technicianId?: string } {
  if (isTechnician(session.role)) return { technicianId: session.userId };
  return {};
}

export function orgScope(organizationId: string) {
  return { organizationId };
}

export async function assertClientInOrg(clientId: number, organizationId: string) {
  const { prisma } = await import("@/lib/prisma");
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    select: { id: true },
  });
  return client !== null;
}

export async function assertUserInOrg(userId: string, organizationId: string) {
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: { id: true, role: true },
  });
  return user;
}

export const INVALID_ASSIGNEE = Symbol("invalid-assignee");

/**
 * Normalizza un `assignedUserId` in ingresso: ritorna null (nessun tecnico),
 * l'id valido, oppure INVALID_ASSIGNEE se l'utente non è dell'organizzazione.
 */
export async function resolveAssignedUser(
  raw: unknown,
  organizationId: string
): Promise<string | null | typeof INVALID_ASSIGNEE> {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return INVALID_ASSIGNEE;
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findFirst({
    where: { id: raw, organizationId, attivo: true },
    select: { id: true },
  });
  return user ? user.id : INVALID_ASSIGNEE;
}
