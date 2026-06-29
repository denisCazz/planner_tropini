import { NextResponse } from "next/server";
import { getSession, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

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
