import { createAuthClient, getRememberMePreference } from "@/lib/supabase/browserAuth";

export function createClient() {
  return createAuthClient(getRememberMePreference());
}
