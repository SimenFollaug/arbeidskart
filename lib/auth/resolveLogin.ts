const USERNAME_DOMAIN = "arbeidskart.local";

export class LoginResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginResolveError";
  }
}

/** Fallback når API/RPC ikke finnes (migrasjon ikke kjørt). */
export function toEmailFallback(identifier: string): string {
  const v = identifier.trim();
  return v.includes("@") ? v.toLowerCase() : `${v.toLowerCase()}@${USERNAME_DOMAIN}`;
}

/** Slår opp riktig auth-e-post for brukernavn eller e-post. */
export async function resolveLoginEmail(identifier: string): Promise<string> {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new LoginResolveError("Skriv inn brukernavn eller e-post.");
  }

  let res: Response;
  try {
    res = await fetch("/api/auth/resolve-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: trimmed }),
    });
  } catch {
    throw new LoginResolveError(
      "Kunne ikke kontakte serveren. Sjekk nettverket og prøv igjen.",
    );
  }

  let body: { email?: string; error?: string };
  try {
    body = (await res.json()) as { email?: string; error?: string };
  } catch {
    throw new LoginResolveError(
      "Innloggingstjenesten svarte uventet. Last siden på nytt og prøv igjen.",
    );
  }

  if (res.ok && body.email) {
    return body.email;
  }

  if (res.status === 404 && body.error) {
    throw new LoginResolveError(body.error);
  }

  if (!res.ok && body.error) {
    throw new LoginResolveError(body.error);
  }

  // Ikke gjett på @arbeidskart.local – det gir «Invalid login credentials».
  throw new LoginResolveError(
    `Fant ingen bruker med «${trimmed}». Sjekk staving, eller logg inn med e-post.`,
  );
}
