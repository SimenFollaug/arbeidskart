"use client";

import { useEffect, useRef, useState } from "react";
import {
  BACKGROUND_LAYERS,
  WMS_LAYERS_BY_GROUP,
  legendUrl,
} from "@/lib/wmsLayers";
import type { ImportedRoute } from "@/lib/importRoute";
import {
  PROFILE_OPTIONS,
  type ProfileId,
} from "@/lib/layerPreferences";

export interface LayerState {
  id: string;
  enabled: boolean;
  opacity: number;
}

interface LayerControlProps {
  layers: LayerState[];
  backgroundId: string;
  profileId: ProfileId;
  onProfileChange: (profileId: ProfileId) => void;
  onToggle: (id: string) => void;
  onOpacity: (id: string, opacity: number) => void;
  onBackground: (id: string) => void;
  showDeleted: boolean;
  onToggleDeleted: () => void;
  showDrawings: boolean;
  onToggleDrawings: () => void;
  showCompleted: boolean;
  onToggleCompleted: () => void;
  importedRoutes: ImportedRoute[];
  onImportRoute: (file: File) => void;
  onToggleImportedRoute: (id: string) => void;
  onRemoveImportedRoute: (id: string) => void;
  onClearImportedRoutes: () => void;
}

export function LayerControl({
  layers,
  backgroundId,
  profileId,
  onProfileChange,
  onToggle,
  onOpacity,
  onBackground,
  showDeleted,
  onToggleDeleted,
  showDrawings,
  onToggleDrawings,
  showCompleted,
  onToggleCompleted,
  importedRoutes,
  onImportRoute,
  onToggleImportedRoute,
  onRemoveImportedRoute,
  onClearImportedRoutes,
}: LayerControlProps) {
  // Start collapsed (avoids a hydration mismatch and keeps the map clear on
  // phones); expand automatically on tablet/desktop after mount.
  const [open, setOpen] = useState(false);
  const [legendFor, setLegendFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      setOpen(true);
    }
  }, []);

  const stateOf = (id: string) => layers.find((l) => l.id === id);

  return (
    <div className="relative w-full">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-800"
        >
          Kartlag
          <span className="text-slate-400">{open ? "▾" : "▸"}</span>
        </button>

        {open && (
          <div className="max-h-[70vh] overflow-y-auto border-t border-slate-100 px-4 py-3">
            <div className="mb-4">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Lagprofil
              </span>
              <select
                value={profileId}
                onChange={(e) => onProfileChange(e.target.value as ProfileId)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              >
                {PROFILE_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Valget huskes på denne enheten. Endrer du lag manuelt, byttes
                profil til Egendefinert.
              </p>
            </div>

            <div className="space-y-4">
              {WMS_LAYERS_BY_GROUP.map(({ group, layers: groupLayers }) => (
                <div key={group}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {group}
                  </p>
                  <div className="space-y-2">
                    {groupLayers.map((cfg) => {
                      const st = stateOf(cfg.id);
                      if (!st) return null;
                      return (
                        <div
                          key={cfg.id}
                          className="rounded-lg bg-slate-50 p-2.5"
                        >
                          <label className="flex cursor-pointer items-start gap-2">
                            <input
                              type="checkbox"
                              checked={st.enabled}
                              onChange={() => onToggle(cfg.id)}
                              className="mt-0.5 h-4 w-4 accent-blue-600"
                            />
                            <span className="flex-1">
                              <span className="block text-sm font-medium text-slate-800">
                                {cfg.name}
                              </span>
                              <span className="block text-xs text-slate-500">
                                {cfg.attribution}
                                {!st.enabled && cfg.id === "utvalgte_naturtyper" && (
                                  <span className="mt-0.5 block text-amber-700">
                                    Slått av – huk av for å vise i kartet
                                  </span>
                                )}
                                {!st.enabled && cfg.id === "hogstklasser" && (
                                  <span className="mt-0.5 block text-amber-700">
                                    Slått av – huk av og zoom inn (ca. 1:100 000)
                                  </span>
                                )}
                                {cfg.layerHint && (
                                  <span className="mt-0.5 block text-amber-700">
                                    {cfg.layerHint}
                                  </span>
                                )}
                              </span>
                            </span>
                          </label>

                          {st.enabled && (
                            <div className="mt-2 pl-6">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">
                                  Synlig
                                </span>
                                <input
                                  type="range"
                                  min={0.2}
                                  max={1}
                                  step={0.1}
                                  value={st.opacity}
                                  onChange={(e) =>
                                    onOpacity(cfg.id, Number(e.target.value))
                                  }
                                  className="flex-1 accent-blue-600"
                                />
                                <button
                                  onClick={() =>
                                    setLegendFor((p) =>
                                      p === cfg.id ? null : cfg.id,
                                    )
                                  }
                                  className="text-xs font-medium text-blue-600 hover:underline"
                                >
                                  Tegnforklaring
                                </button>
                              </div>
                              {legendFor === cfg.id && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={legendUrl(cfg)}
                                  alt={`Tegnforklaring for ${cfg.name}`}
                                  className="mt-2 max-w-full rounded border border-slate-200 bg-white"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Importert rute
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportRoute(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-900 hover:bg-cyan-100"
              >
                Importer GPX / KML
              </button>
              {importedRoutes.length > 0 && (
                <div className="mt-2 space-y-2">
                  {importedRoutes.map((route) => (
                    <div
                      key={route.id}
                      className="rounded-lg bg-slate-50 p-2.5"
                    >
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          checked={route.visible}
                          onChange={() => onToggleImportedRoute(route.id)}
                          className="mt-0.5 h-4 w-4 accent-blue-600"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: route.color }}
                            />
                            <span className="truncate text-sm font-medium text-slate-800">
                              {route.name}
                            </span>
                          </span>
                          <span className="block text-xs text-slate-500">
                            {route.source.toUpperCase()} ·{" "}
                            {route.segments.length} segment
                            {route.segments.length === 1 ? "" : "er"}
                            {route.waypoints.length > 0
                              ? ` · ${route.waypoints.length} punkt`
                              : ""}
                          </span>
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => onRemoveImportedRoute(route.id)}
                        className="mt-2 pl-6 text-xs font-medium text-red-600 hover:underline"
                      >
                        Fjern
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={onClearImportedRoutes}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
                  >
                    Fjern alle importerte ruter
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Kommentarer
              </span>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-slate-50 p-2.5">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={onToggleDeleted}
                  className="mt-0.5 h-4 w-4 accent-blue-600"
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-slate-800">
                    Slettede kommentarer
                  </span>
                  <span className="block text-xs text-slate-500">
                    Vis hvor tidligere kommentarer lå (grå, stiplede markører).
                  </span>
                </span>
              </label>
              <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg bg-slate-50 p-2.5">
                <input
                  type="checkbox"
                  checked={showDrawings}
                  onChange={onToggleDrawings}
                  className="mt-0.5 h-4 w-4 accent-blue-600"
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-slate-800">
                    Tegninger (linjer og soner)
                  </span>
                  <span className="block text-xs text-slate-500">
                    Vis arbeidsområder og ruter tegnet i kartet.
                  </span>
                </span>
              </label>
              <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg bg-slate-50 p-2.5">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={onToggleCompleted}
                  className="mt-0.5 h-4 w-4 accent-blue-600"
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-slate-800">
                    Fullførte jobber
                  </span>
                  <span className="block text-xs text-slate-500">
                    Vis jobber som er kvittert ut (skjules som standard).
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Bakgrunn
              </span>
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                {BACKGROUND_LAYERS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onBackground(b.id)}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                      backgroundId === b.id
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
