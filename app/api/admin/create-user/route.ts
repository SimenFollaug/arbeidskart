import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminApiConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface CreateUserBody {
  fullName?: string;
  email?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  if (!isAdminApiConfigured()) {
    return NextResponse.json(
      { error: "Brukeropprettelse er ikke konfigurert på serveren." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin || !profile.organization_id) {
    return NextResponse.json({ error: "Kun administrator kan opprette brukere." }, { status: 403 });
  }

  let body: CreateUserBody;
  try {
    body = (await request.json()) as CreateUserBody;
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const fullName = body.fullName?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (fullName.length < 2) {
    return NextResponse.json({ error: "Skriv inn fullt navn." }, { status: 400 });
  }
  if (!email.includes("@") || !email.includes(".")) {
    return NextResponse.json({ error: "Ugyldig e-postadresse." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Passord må være minst 8 tegn." },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: fullName,
        full_name: fullName,
        organization_id: profile.organization_id,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        return NextResponse.json(
          { error: "E-postadressen er allerede registrert." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      userId: data.user?.id ?? null,
      email,
      fullName,
    });
  } catch (err) {
    console.warn("create-user feil:", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("invalid header value") || msg.includes("Bearer")) {
      return NextResponse.json(
        {
          error:
            "Server-nøkkel (SUPABASE_SERVICE_ROLE_KEY) er ugyldig. Sjekk at den er limt inn uten mellomrom i Vercel.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: "Kunne ikke opprette bruker." },
      { status: 500 },
    );
  }
}
