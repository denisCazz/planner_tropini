import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { TROPINI_ORG_SLUG } from "@/lib/tropini";

export { SESSION_COOKIE } from "@/lib/auth-constants";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  userId: string;
  username: string;
  role: "ADMIN" | "USER" | "TECNICO";
  organizationId: string;
  organizationName: string;
};

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET non configurato");
  }
  return new TextEncoder().encode(secret);
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<SessionPayload | null> {
  const user = await prisma.user.findUnique({
    where: { username: username.trim() },
    include: { organization: true },
  });

  if (!user?.organizationId || !user.organization) return null;
  if (user.attivo === false) return null;
  if (user.organization.slug !== TROPINI_ORG_SLUG) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
  };
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const userId = payload.userId;
    const username = payload.username;
    const role = payload.role;
    const organizationId = payload.organizationId;
    const organizationName = payload.organizationName;

    if (
      typeof userId !== "string" ||
      typeof username !== "string" ||
      (role !== "ADMIN" && role !== "USER" && role !== "TECNICO") ||
      typeof organizationId !== "string" ||
      typeof organizationName !== "string"
    ) {
      return null;
    }

    return { userId, username, role, organizationId, organizationName };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { organization: true },
  });
  if (!user?.organizationId || !user.organization) return null;
  if (user.attivo === false) return null;
  if (user.organization.slug !== TROPINI_ORG_SLUG) return null;

  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
  };
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
}

export function forbiddenResponse() {
  return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
}
