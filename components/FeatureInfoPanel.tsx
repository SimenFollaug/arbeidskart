"use client";

import {
  featureTitle,
  isUrl,
  pickDisplayFields,
} from "@/lib/featureInfoParse";

export interface FeatureInfoData {
  loading: boolean;
  lat: number;
  lng: number;
  results: {
    layerId: string;
    layerName: string;
    features: Record<string, unknown>[];
  }[];
}

interface FeatureInfoPanelProps {
  data: FeatureInfoData | null;
  onClose: () => void;
  onAddHere: (lat: number, lng: number) => void;
}

function FeatureValue({ value }: { value: unknown }) {
  const text = String(value);
  if (isUrl(value)) {
    return (
      <a
        href={text}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-blue-600 hover:underline"
      >
        Åpne lenke
      </a>
    );
  }
  return <span className="break-words text-right font-medium text-slate-800">{text}</span>;
}

export function FeatureInfoPanel({
  data,
  onClose,
  onAddHere,
}: FeatureInfoPanelProps) {
  if (!data) return null;

  const hasResults = data.results.some((r) => r.features.length > 0);

  return (
    <div className="absolute bottom-3 left-3 z-[1000] w-80 max-w-[calc(100vw-1.5rem)] sm:w-96">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <span className="text-sm font-semibold text-slate-800">
            Kartinfo
          </span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Lukk"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-4 py-3 text-sm">
          {data.loading ? (
            <p className="text-slate-500">Henter informasjon…</p>
          ) : !hasResults ? (
            <p className="text-slate-500">
              Ingen objekter funnet på dette punktet i de aktive lagene. Klikk
              på et markert kulturminne, en verna sone eller eiendomsgrense, og
              sjekk at riktig kartlag er slått på.
            </p>
          ) : (
            <div className="space-y-4">
              {data.results
                .filter((r) => r.features.length > 0)
                .map((r) => (
                  <div key={r.layerId}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {r.layerName}
                    </p>
                    <div className="space-y-2">
                      {r.features.map((f, i) => {
                        const title = featureTitle(f);
                        const fields = pickDisplayFields(f).filter(
                          ([key]) => key !== "_title",
                        );
                        return (
                          <div
                            key={i}
                            className="rounded-lg bg-slate-50 px-3 py-2.5"
                          >
                            {title && (
                              <p className="mb-2 font-semibold text-slate-900">
                                {title}
                              </p>
                            )}
                            {fields.length > 0 ? (
                              <dl className="space-y-1">
                                {fields.map(([key, label, value]) => (
                                  <div
                                    key={key}
                                    className="flex justify-between gap-3 py-0.5"
                                  >
                                    <dt className="shrink-0 text-slate-500">
                                      {label}
                                    </dt>
                                    <dd className="min-w-0">
                                      <FeatureValue value={value} />
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            ) : (
                              !title && (
                                <p className="text-slate-600">
                                  Objekt uten detaljert info.
                                </p>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-4 py-2.5">
          <button
            onClick={() => onAddHere(data.lat, data.lng)}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Legg kommentar her
          </button>
        </div>
      </div>
    </div>
  );
}
