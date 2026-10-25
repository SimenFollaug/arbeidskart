/** Leser feilmelding fra Supabase PostgREST (ikke alltid `instanceof Error`). */
export function supabaseErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message;
    if (typeof o.details === "string" && o.details.trim()) return o.details;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Noe gikk galt";
}

export function drawingSaveErrorMessage(err: unknown): string {
  const raw = supabaseErrorMessage(err).toLowerCase();
  if (
    raw.includes("map_drawings") &&
    (raw.includes("schema cache") ||
      raw.includes("does not exist") ||
      raw.includes("could not find"))
  ) {
    return (
      "Tegning-tabellen finnes ikke i databasen ennå. " +
      "Kjør supabase/migrations/0005_map_drawings.sql i Supabase → SQL Editor."
    );
  }
  return supabaseErrorMessage(err);
}
