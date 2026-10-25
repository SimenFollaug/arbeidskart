"use client";

import { jobStatus, type JobFields } from "@/lib/types";
import { googleMapsDirectionsUrl } from "@/lib/navigation";

export type JobAction = "claim" | "release" | "complete" | "reopen";

interface JobItem extends JobFields {
  category: string;
}

interface JobActionsProps {
  item: JobItem;
  lat?: number | null;
  lng?: number | null;
  currentUserId: string;
  isAdmin: boolean;
  onAction: (action: JobAction) => void;
}

function fmt(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("no-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Claim/kvittering-arbeidsflyt for elementer i "Arbeid"-kategorien. */
export function JobActions({
  item,
  lat,
  lng,
  currentUserId,
  isAdmin,
  onAction,
}: JobActionsProps) {
  if (item.category !== "arbeid") return null;

  const status = jobStatus(item);
  const isClaimer = item.claimed_by === currentUserId;
  const canManageClaim = isClaimer || isAdmin;
  const canReopen = item.completed_by === currentUserId || isAdmin;

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const badge =
    status === "fullfort"
      ? { text: "Fullført", cls: "bg-green-100 text-green-700" }
      : status === "tatt"
        ? { text: "Tatt", cls: "bg-amber-100 text-amber-800" }
        : { text: "Ledig", cls: "bg-slate-100 text-slate-600" };

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Jobb
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}
        >
          {badge.text}
        </span>
      </div>

      {status === "tatt" && (
        <p className="mt-1 text-[11px] text-slate-500">
          Tatt av {item.claimed_by_name ?? "ukjent"}
          {item.claimed_at ? ` · ${fmt(item.claimed_at)}` : ""}
        </p>
      )}
      {status === "fullfort" && (
        <p className="mt-1 text-[11px] text-green-700">
          Fullført av {item.completed_by_name ?? "ukjent"}
          {item.completed_at ? ` · ${fmt(item.completed_at)}` : ""}
        </p>
      )}

      <div className="mt-1.5 flex flex-wrap gap-2">
        {lat != null && lng != null && (
          <a
            href={googleMapsDirectionsUrl(lat, lng)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
          >
            Naviger
          </a>
        )}
        {status === "ledig" && (
          <button
            onClick={stop(() => onAction("claim"))}
            className="rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
          >
            Ta jobben
          </button>
        )}
        {status === "tatt" && canManageClaim && (
          <>
            <button
              onClick={stop(() => onAction("complete"))}
              className="rounded bg-green-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-green-700"
            >
              Kvitter ut
            </button>
            <button
              onClick={stop(() => onAction("release"))}
              className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
            >
              Frigi
            </button>
          </>
        )}
        {status === "fullfort" && canReopen && (
          <button
            onClick={stop(() => onAction("reopen"))}
            className="rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
          >
            Gjenåpne
          </button>
        )}
      </div>
    </div>
  );
}
