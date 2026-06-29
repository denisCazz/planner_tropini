import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  sessionCookieOptions,
  verifyCredentials,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!process.env.AUTH_SECRET || !process.env.AUTH_USERNAME || !process.env.AUTH_PASSWORD) {
    return NextResponse.json(
      { error: "Autenticazione non configurata sul server" },
      { status: 503 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username e password obbligatori" },
      { status: 400 }
    );
  }

  if (!verifyCredentials(username, password)) {
    return NextResponse.json(
      { error: "Credenziali non valide" },
      { status: 401 }
    );
  }

  const token = await createSessionToken(username);
  const response = NextResponse.json({ ok: true });
  const cookie = sessionCookieOptions(token);
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    maxAge: cookie.maxAge,
  });

  return response;
}
