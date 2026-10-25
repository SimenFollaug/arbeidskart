"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { checkAreaAtVertices, type AreaHit } from "@/lib/areaCheck";
import type { AppUser, Audience, DrawingType } from "@/lib/types";
import { AudiencePicker } from "@/components/AudiencePicker";

interface DrawDialogProps {
  open: boolean;
  drawingType: DrawingType;
  vertices: [number, number][];
  saving: boolean;
  users: AppUser[];
  currentUserId: string;
  onClose: () => void;
  onSave: (values: {
    title: string;
    body: string;
    category: string;
    audience: Audience;
    recipientIds: string[];
  }) => void;
}

export function DrawDialog({
  open,
  drawingType,
  vertices,
  saving,
  users,
  currentUserId,
  onClose,
  onSave,
}: DrawDialogProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("arbeid");
  const [audience, setAudience] = useState<Audience>("all");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [areaHits, setAreaHits] = useState<AreaHit[]>([]);
  const [areaLoading, setAreaLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setBody("");
    setCategory("arbeid");
    setAudience("all");
    setRecipientIds([]);
  }, [open]);

  useEffect(() => {
    if (!open || vertices.length < 2) {
      setAreaHits([]);
      return;
    }
    let cancelled = false;
    setAreaLoading(true);
    setAreaHits([]);
    checkAreaAtVertices(vertices, drawingType).then((hits) => {
      if (!cancelled) {
        setAreaHits(hits);
        setAreaLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, vertices, drawingType]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      title,
      body,
      category,
      audience,
      recipientIds: audience === "selected" ? recipientIds : [],
    });
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {drawingType === "polygon" ? "Ny sone" : "Ny linje"}
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
              Sjekker vern og naturfare langs tegningen…
            </p>
          )}
          {areaHits.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-semibold">
                ⚠ OBS – tegningen berører beskyttet eller utsatt område
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
                Sjekk at arbeid er tillatt i hele{" "}
                {drawingType === "polygon" ? "sonen" : "traséen"} før du
                lagrer.
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
              placeholder={
                drawingType === "polygon"
                  ? "F.eks. Arbeidsområde – nord"
                  : "F.eks. Kjørerute til anlegg"
              }
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
              placeholder="Hva gjelder denne tegningen?"
            />
          </label>

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

          <AudiencePicker
            users={users}
            currentUserId={currentUserId}
            audience={audience}
            recipientIds={recipientIds}
            onAudienceChange={setAudience}
            onRecipientsChange={setRecipientIds}
          />

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
              {saving ? "Lagrer…" : "Lagre tegning"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
