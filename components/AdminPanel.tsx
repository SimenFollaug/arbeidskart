"use client";

import { useEffect, useState } from "react";
import type { createClient } from "@/lib/supabase/client";
import type { AppUser } from "@/lib/types";

type SupabaseClient = ReturnType<typeof createClient>;

interface AdminPanelProps {
  open: boolean;
  users: AppUser[];
  currentUserId: string;
  supabase: SupabaseClient;
  onClose: () => void;
  onUsersChanged?: () => void;
}

export function AdminPanel({
  open,
  users,
  currentUserId,
  supabase,
  onClose,
  onUsersChanged,
}: AdminPanelProps) {
  const [rows, setRows] = useState<AppUser[]>(users);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setRows(users);
  }, [users]);

  if (!open) return null;

  async function reloadUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, is_admin")
      .order("full_name", { ascending: true });
    if (data) setRows(data as AppUser[]);
    onUsersChanged?.();
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Kunne ikke opprette bruker");
        return;
      }
      setSuccess(`Bruker opprettet: ${fullName}`);
      setFullName("");
      setEmail("");
      setPassword("");
      await reloadUsers();
    } catch {
      setError("Kunne ikke opprette bruker");
    } finally {
      setCreating(false);
    }
  }

  async function toggleAdmin(user: AppUser) {
    const next = !user.is_admin;
    setBusyId(user.id);
    setError(null);
    setSuccess(null);
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ is_admin: next })
      .eq("id", user.id);
    setBusyId(null);
    if (updErr) {
      setError(updErr.message || "Kunne ikke endre admin-status");
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.id === user.id ? { ...r, is_admin: next } : r)),
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Administrer brukere
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Lukk"
          >
            ✕
          </button>
        </div>

        <p className="mb-3 text-xs text-slate-500">
          Bedriftsadministratorer ser alle kommentarer og tegninger i bedriften,
          og kan redigere og slette alt der.
        </p>

        <form
          onSubmit={handleCreateUser}
          className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
          <p className="mb-2 text-sm font-medium text-slate-800">
            Opprett ny bruker
          </p>
          <div className="space-y-2">
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Fullt navn"
              className="admin-input"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-post"
              className="admin-input"
              autoComplete="off"
            />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passord (min. 8 tegn)"
              className="admin-input"
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {creating ? "Oppretter…" : "Opprett bruker"}
          </button>
        </form>

        {error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            {success}
          </p>
        )}

        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {rows.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {u.full_name ?? "Uten navn"}
                    {isSelf && (
                      <span className="ml-1 text-xs text-slate-400">(deg)</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    {u.is_admin ? "Administrator" : "Vanlig bruker"}
                  </p>
                </div>
                <button
                  onClick={() => toggleAdmin(u)}
                  disabled={busyId === u.id || isSelf}
                  title={
                    isSelf
                      ? "Du kan ikke endre din egen admin-status"
                      : undefined
                  }
                  className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                    u.is_admin
                      ? "border border-slate-300 text-slate-600 hover:bg-slate-50"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {busyId === u.id
                    ? "…"
                    : u.is_admin
                      ? "Fjern admin"
                      : "Gjør til admin"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <style jsx global>{`
        .admin-input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #cbd5e1;
          padding: 0.5rem 0.65rem;
          font-size: 0.875rem;
          outline: none;
          background: #fff;
        }
        .admin-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }
      `}</style>
    </div>
  );
}
