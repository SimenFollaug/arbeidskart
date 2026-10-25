"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, STATUSES } from "@/lib/categories";
import { checkAreaAtPoint, type AreaHit } from "@/lib/areaCheck";
import type {
  AppUser,
  Audience,
  Comment,
  CommentStatus,
  NewComment,
} from "@/lib/types";
import { AudiencePicker } from "@/components/AudiencePicker";

interface CommentDialogProps {
  open: boolean;
  /** When editing an existing comment. */
  editing: Comment | null;
  /** Coordinates for a new comment. */
  location: { lat: number; lng: number } | null;
  saving: boolean;
  users: AppUser[];
  currentUserId: string;
  onClose: () => void;
  onSave: (values: NewComment) => void;
}

export function CommentDialog({
  open,
  editing,
  location,
  saving,
  users,
  currentUserId,
  onClose,
  onSave,
}: CommentDialogProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("arbeid");
  const [status, setStatus] = useState<CommentStatus>("apen");
  const [files, setFiles] = useState<File[]>([]);
  const [audience, setAudience] = useState<Audience>("all");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [areaHits, setAreaHits] = useState<AreaHit[]>([]);
  const [areaLoading, setAreaLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    if (editing) {
      setTitle(editing.title);
      setBody(editing.body ?? "");
      setCategory(editing.category);
      setStatus(editing.status);
      setAudience(editing.audience);
      setRecipientIds(editing.recipients.map((r) => r.id));
    } else {
      setTitle("");
      setBody("");
      setCategory("arbeid");
      setStatus("apen");
      setAudience("all");
      setRecipientIds([]);
    }
  }, [open, editing]);

  const lat = editing?.lat ?? location?.lat;
  const lng = editing?.lng ?? location?.lng;

  // Sjekk vern/naturfare på punktet når dialogen åpnes.
  useEffect(() => {
    if (!open || lat == null || lng == null) {
      setAreaHits([]);
      return;
    }
    let cancelled = false;
    setAreaLoading(true);
    setAreaHits([]);
    checkAreaAtPoint(lat, lng).then((hits) => {
      if (!cancelled) {
        setAreaHits(hits);
        setAreaLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, lat, lng]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lat == null || lng == null) return;
    onSave({
      title,
      body,
      category,
      status,
      lat,
      lng,
      files,
      audience,
      recipientIds: audience === "selected" ? recipientIds : [],
    });
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {editing ? "Rediger kommentar" : "Ny kommentar"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Lukk"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {areaLoading && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Sjekker vern og naturfare på punktet…
            </p>
          )}
          {areaHits.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-semibold">
                ⚠ OBS – punktet ligger i et beskyttet eller utsatt område
              </p>
              <ul className="mt-1.5 space-y-1">
                {areaHits.map((h) => (
                  <li key={h.layerId} className="flex gap-1.5">
                    <span>{h.kind === "hazard" ? "🔴" : "🟢"}</span>
                    <span>
                      <span className="font-medium">{h.layerName}</span>
                      {h.name ? ` – ${h.name}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-amber-800">
                Vurder om arbeid er tillatt her før du lagrer kommentaren.
              </p>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Tittel
            </span>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              placeholder="F.eks. Verneområde – ikke kjør her"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Beskrivelse
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              placeholder="Detaljer som andre arbeidere bør vite om…"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Kategori
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Status
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CommentStatus)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <AudiencePicker
            users={users}
            currentUserId={currentUserId}
            audience={audience}
            recipientIds={recipientIds}
            onAudienceChange={setAudience}
            onRecipientsChange={setRecipientIds}
          />

          <div className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Bilder
            </span>
            {editing?.photos && editing.photos.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {editing.photos.map((p) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={p.id}
                    src={p.url}
                    alt="Vedlegg"
                    className="h-16 w-16 rounded border border-slate-200 object-cover"
                  />
                ))}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-xs text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <span
                    key={i}
                    className="max-w-[12rem] truncate rounded bg-slate-100 px-2 py-1 text-xs text-slate-600"
                  >
                    {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {lat != null && lng != null && (
            <p className="text-xs text-slate-400">
              Posisjon: {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Lagrer…" : "Lagre"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
