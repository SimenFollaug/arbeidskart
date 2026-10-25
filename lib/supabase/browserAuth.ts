import { createBrowserClient } from "@supabase/ssr";

const REMEMBER_KEY = "arbeidskart.rememberMe";

/** Varig innlogging (ca. 1 år) vs. kortere session (1 dag). */
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 400;
const SESSION_MAX_AGE = 60 * 60 * 24;

export function getRememberMePreference(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(REMEMBER_KEY) !== "0";
}

export function setRememberMePreference(remember: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
}

export function createAuthClient(rememberMe?: boolean) {
  const remember = rememberMe ?? getRememberMePreference();
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: remember ? REMEMBER_MAX_AGE : SESSION_MAX_AGE,
        sameSite: "lax",
        path: "/",
      },
    },
  );
}
