import { NextResponse, type NextRequest } from "next/server";
import { searchGnrbnr } from "@/lib/search/gnrbnrLookup";
import { parseGnrbnrQuery } from "@/lib/search/parseGnrbnr";
import type { SearchResult } from "@/lib/search/types";

export type { SearchResult } from "@/lib/search/types";

interface GeonorgeAddress {
  adressetekst?: string;
  poststed?: string;
  postnummer?: string;
  kommunenavn?: string;
  gardsnummer?: number;
  bruksnummer?: number;
  representasjonspunkt?: { lat: number; lon: number };
}

interface StedsnavnResult {
  skrivemåte?: string;
  navneobjekttype?: string;
  kommuner?: { kommunenavn: string }[];
  representasjonspunkt?: { nord: number; "øst": number };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function mapAddress(a: GeonorgeAddress, type: SearchResult["type"]): SearchResult | null {
  const p = a.representasjonspunkt;
  if (!p) return null;
  const gnrbnr =
    a.gardsnummer != null && a.bruksnummer != null
      ? ` · gnr ${a.gardsnummer}/bnr ${a.bruksnummer}`
      : "";
  return {
    label: a.adressetekst ?? "Adresse",
    sublabel: `${a.postnummer ?? ""} ${a.poststed ?? a.kommunenavn ?? ""}`.trim() + gnrbnr,
    lat: p.lat,
    lng: p.lon,
    type,
  };
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const gnrbnr = parseGnrbnrQuery(q);
  if (gnrbnr) {
    const results = await searchGnrbnr(gnrbnr);
    return NextResponse.json({ results });
  }

  const encoded = encodeURIComponent(q);
  const [addr, sted] = await Promise.all([
    fetchJson<{ adresser?: GeonorgeAddress[] }>(
      `https://ws.geonorge.no/adresser/v1/sok?sok=${encoded}&treffPerSide=5`,
    ),
    fetchJson<{ navn?: StedsnavnResult[] }>(
      `https://api.kartverket.no/stedsnavn/v1/navn?sok=${encoded}&fuzzy=true&treffPerSide=5&utkoordsys=4258`,
    ),
  ]);

  const results: SearchResult[] = [];

  for (const a of addr?.adresser ?? []) {
    const r = mapAddress(a, "adresse");
    if (r) results.push(r);
  }

  for (const n of sted?.navn ?? []) {
    const p = n.representasjonspunkt;
    if (!p) continue;
    results.push({
      label: n.skrivemåte ?? "Sted",
      sublabel: `${n.navneobjekttype ?? "Sted"} · ${n.kommuner?.[0]?.kommunenavn ?? ""}`.trim(),
      lat: p.nord,
      lng: p["øst"],
      type: "sted",
    });
  }

  return NextResponse.json({ results: results.slice(0, 10) });
}
