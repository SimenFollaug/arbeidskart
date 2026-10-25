import { createClient } from "@supabase/supabase-js";

/** Fjerner whitespace fra limt inn nøkkel (linjeskift/mellomrom gjør Bearer ugyldig). */
function sanitizeServiceRoleKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/\s+/g, "");
  return cleaned || undefined;
}

/** Service role – kun på server (API-ruter). */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = sanitizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY mangler");
  }
  if (/\s/.test(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY inneholdt whitespace – sjekk Vercel env var",
    );
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isAdminApiConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      sanitizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
}
