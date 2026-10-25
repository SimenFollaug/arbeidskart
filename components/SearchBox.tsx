"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/lib/search/types";

interface SearchBoxProps {
  onSelect: (lat: number, lng: number) => void;
}

export function SearchBox({ onSelect }: SearchBoxProps) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sok?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
        setActiveIdx(-1);
      } catch {
        // ignored (typically an aborted request)
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function choose(r: SearchResult) {
    onSelect(r.lat, r.lng);
    setQ(r.label);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIdx] ?? results[0];
      if (r) choose(r);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="flex-shrink-0 text-slate-400"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Søk adresse, sted eller gnr/bnr…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {loading && (
          <span className="h-3.5 w-3.5 flex-shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
        )}
        {q && !loading && (
          <button
            onClick={() => {
              setQ("");
              setResults([]);
              setOpen(false);
            }}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600"
            aria-label="Tøm søk"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <ul className="absolute bottom-full left-0 right-0 mb-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg md:bottom-auto md:top-full md:mb-0 md:mt-1">
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-slate-400">Ingen treff</li>
          ) : (
            results.map((r, i) => (
              <li key={`${r.label}-${i}`}>
                <button
                  onClick={() => choose(r)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left transition ${
                    i === activeIdx ? "bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="mt-0.5 flex-shrink-0 text-xs">
                    {r.type === "sted" ? "📍" : r.type === "gnrbnr" ? "🏘️" : "🏠"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {r.label}
                    </span>
                    {r.sublabel && (
                      <span className="block truncate text-xs text-slate-500">
                        {r.sublabel}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
