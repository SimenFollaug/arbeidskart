"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createAuthClient,
  getRememberMePreference,
  setRememberMePreference,
} from "@/lib/supabase/browserAuth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { resolveLoginEmail, LoginResolveError } from "@/lib/auth/resolveLogin";
import { SetupNotice } from "@/components/SetupNotice";
import { AppCredit } from "@/components/AppCredit";

function describeError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message) return obj.message;
    if (typeof obj.error_description === "string") return obj.error_description;
    if (typeof obj.error === "string") return obj.error;
  }
  return "Noe gikk galt. Sjekk nettverk/konsoll for detaljer.";
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectedFrom = params.get("redirectedFrom") || "/map";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setRememberMe(getRememberMePreference());
  }, []);

  useEffect(() => {
    const code = params.get("error");
    if (code === "no-organization") {
      setError("Brukeren er ikke knyttet til en bedrift. Kontakt administrator.");
    } else if (code === "organization-inactive") {
      setError("Bedriftens tilgang er deaktivert. Kontakt leverandør.");
    }
  }, [params]);

  if (!isSupabaseConfigured) {
    return <SetupNotice />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      setRememberMePreference(rememberMe);
      const supabase = createAuthClient(rememberMe);
      const loginEmail = await resolveLoginEmail(email);
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (error) throw error;
      router.replace(redirectedFrom);
      router.refresh();
    } catch (err) {
      console.warn("Auth-feil:", err);
      if (err instanceof LoginResolveError) {
        setError(err.message);
      } else {
        const msg = describeError(err);
        setError(
          msg.toLowerCase().includes("invalid login credentials")
            ? "Feil brukernavn/e-post eller passord."
            : msg,
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email.trim()) {
      setError("Skriv inn e-postadressen din først.");
      return;
    }
    if (!email.trim().includes("@")) {
      setError(
        "Innloggingslenke krever e-post. Bruk passord for å logge inn med brukernavn.",
      );
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = createAuthClient(rememberMe);
      const loginEmail = await resolveLoginEmail(email);
      const { error } = await supabase.auth.signInWithOtp({
        email: loginEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            redirectedFrom,
          )}`,
        },
      });
      if (error) throw error;
      setInfo("Sjekk e-posten din for en innloggingslenke.");
    } catch (err) {
      console.warn("Auth-feil (magic link):", err);
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Arbeidskart</h1>
          <p className="mt-1 text-sm text-slate-600">
            Verneområder, kulturminner, eiendomsgrenser og strømnett – med delte
            kommentarer i kartet.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="mb-5 text-center text-lg font-semibold text-slate-900">
            Logg inn
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="E-post eller brukernavn">
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="navn@firma.no, administrator eller test"
                autoComplete="username"
              />
            </Field>
            <Field label="Passord">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Passord"
                autoComplete="current-password"
              />
            </Field>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              Husk meg på denne enheten
            </label>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {info && (
              <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Vent…" : "Logg inn"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            eller
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={handleMagicLink}
            disabled={loading}
            className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Send meg en innloggingslenke
          </button>

          <p className="mt-5 text-center text-xs text-slate-500">
            Trenger du tilgang? Kontakt administrator for å få opprettet bruker.
          </p>
        </div>

        <AppCredit className="mt-6 text-center" />
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #cbd5e1;
          padding: 0.55rem 0.75rem;
          font-size: 0.9rem;
          outline: none;
        }
        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
