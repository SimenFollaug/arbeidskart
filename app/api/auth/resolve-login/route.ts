import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const USERNAME_DOMAIN = "arbeidskart.local";

function fallbackEmail(identifier: string): string {
  const v = identifier.trim();
  return v.includes("@") ? v.toLowerCase() : `${v.toLowerCase()}@${USERNAME_DOMAIN}`;
}

export async function POST(request: Request) {
  let identifier: string;
  try {
    const body = (await request.json()) as { identifier?: string };
    identifier = body.identifier?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  if (!identifier) {
    return NextResponse.json(
      { error: "Skriv inn brukernavn eller e-post." },
      { status: 400 },
    );
  }

  if (identifier.includes("@")) {
    return NextResponse.json({ email: identifier.toLowerCase() });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase er ikke konfigurert." },
      { status: 503 },
    );
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc("email_for_login", {
    identifier,
  });

  if (error) {
    const missingFn =
      error.code === "PGRST202" ||
      error.message?.includes("email_for_login") ||
      error.message?.includes("Could not find the function");

    if (missingFn) {
      return NextResponse.json({
        email: fallbackEmail(identifier),
        legacy: true,
      });
    }

    console.warn("resolve-login RPC-feil:", error);
    return NextResponse.json(
      { error: "Kunne ikke slå opp bruker. Prøv igjen." },
      { status: 500 },
    );
  }

  if (typeof data === "string" && data.includes("@")) {
    return NextResponse.json({ email: data });
  }

  return NextResponse.json(
    {
      error: `Fant ingen bruker med «${identifier}». Sjekk staving, eller logg inn med e-post.`,
    },
    { status: 404 },
  );
}
