export function SetupNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Arbeidskart – oppsett
        </h1>
        <p className="mt-2 text-slate-600">
          Appen er nesten klar. Koble til et Supabase-prosjekt for å aktivere
          innlogging, kommentarer og deling.
        </p>
        <ol className="mt-6 space-y-3 text-sm text-slate-700">
          <li>
            <span className="font-medium">1.</span> Opprett et gratis prosjekt
            på{" "}
            <a
              href="https://supabase.com/dashboard"
              className="text-blue-600 underline"
              target="_blank"
              rel="noreferrer"
            >
              supabase.com
            </a>
            .
          </li>
          <li>
            <span className="font-medium">2.</span> Kjør SQL-skriptet{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">
              supabase/migrations/0001_init.sql
            </code>{" "}
            i SQL-editoren.
          </li>
          <li>
            <span className="font-medium">3.</span> Kopier{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">
              Project URL
            </code>{" "}
            og{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">
              anon public key
            </code>{" "}
            inn i <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.local</code>.
          </li>
          <li>
            <span className="font-medium">4.</span> Start på nytt med{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run dev</code>
            .
          </li>
        </ol>
      </div>
    </main>
  );
}
