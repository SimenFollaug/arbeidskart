import { lookupKommune, normalizeName } from "./kommuneLookup";
import type { SearchResult } from "@/lib/search/types";
import type { GnrbnrQuery } from "./parseGnrbnr";

interface GeonorgeAddress {
  adressetekst?: string;
  poststed?: string;
  postnummer?: string;
  kommunenavn?: string;
  kommunenummer?: string;
  gardsnummer?: number;
  bruksnummer?: number;
  representasjonspunkt?: { lat: number; lon: number };
}

interface GeokodingFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    gardsnummer?: number;
    bruksnummer?: number;
    kommunenummer?: string;
    matrikkelnummertekst?: string;
    hovedområde?: boolean;
  };
}

interface GeokodingResponse {
  features?: GeokodingFeature[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function resolveKommuneFromAddressSearch(
  ref: string,
): Promise<{ nummer: string; navn: string } | null> {
  const encoded = encodeURIComponent(ref);
  const data = await fetchJson<{ adresser?: GeonorgeAddress[] }>(
    `https://ws.geonorge.no/adresser/v1/sok?sok=${encoded}&treffPerSide=10`,
  );

  const needle = normalizeName(ref);
  for (const addr of data?.adresser ?? []) {
    if (!addr.kommunenummer || !addr.kommunenavn) continue;
    if (normalizeName(addr.kommunenavn) === needle) {
      return {
        nummer: addr.kommunenummer,
        navn: addr.kommunenavn,
      };
    }
  }

  const first = data?.adresser?.find((a) => a.kommunenummer && a.kommunenavn);
  if (first?.kommunenummer && first.kommunenavn) {
    return { nummer: first.kommunenummer, navn: first.kommunenavn };
  }

  return null;
}

function mapAddress(a: GeonorgeAddress): SearchResult | null {
  const p = a.representasjonspunkt;
  if (!p) return null;
  const gnrbnr =
    a.gardsnummer != null && a.bruksnummer != null
      ? `gnr ${a.gardsnummer}/bnr ${a.bruksnummer}`
      : "";
  return {
    label: a.adressetekst ?? "Matrikkeladresse",
    sublabel:
      [a.kommunenavn, gnrbnr, `${a.postnummer ?? ""} ${a.poststed ?? ""}`.trim()]
        .filter(Boolean)
        .join(" · "),
    lat: p.lat,
    lng: p.lon,
    type: "gnrbnr",
  };
}

function mapGeokoding(
  data: GeokodingResponse,
  kommuneNavn: string,
  gnr: string,
  bnr: string,
): SearchResult | null {
  const features = data.features ?? [];
  if (features.length === 0) return null;

  const feature =
    features.find((f) => f.properties?.hovedområde) ?? features[0];
  const coords = feature.geometry?.coordinates;
  const props = feature.properties;
  if (!coords || coords.length < 2) return null;

  const [lng, lat] = coords;
  const matGnr = props?.gardsnummer ?? gnr;
  const matBnr = props?.bruksnummer ?? bnr;

  return {
    label: `${kommuneNavn} ${matGnr}/${matBnr}`,
    sublabel: `Eiendom · gnr ${matGnr}/bnr ${matBnr}${props?.kommunenummer ? ` · ${props.kommunenummer}` : ""}`,
    lat,
    lng,
    type: "gnrbnr",
  };
}

export async function resolveKommuneNummer(ref: string): Promise<{
  nummer: string;
  navn: string;
} | null> {
  const fromStatic = lookupKommune(ref);
  if (fromStatic) return fromStatic;

  return resolveKommuneFromAddressSearch(ref);
}

export async function searchGnrbnr(query: GnrbnrQuery): Promise<SearchResult[]> {
  const kommune = await resolveKommuneNummer(query.kommuneRef);
  if (!kommune) return [];

  const { nummer, navn } = kommune;
  const geokodingUrl = `https://ws.geonorge.no/eiendom/v1/geokoding?kommunenummer=${nummer}&gardsnummer=${query.gnr}&bruksnummer=${query.bnr}`;

  const geokoding = await fetchJson<GeokodingResponse>(geokodingUrl);
  const eiendom = geokoding
    ? mapGeokoding(geokoding, navn, query.gnr, query.bnr)
    : null;

  const addrData = await fetchJson<{ adresser?: GeonorgeAddress[] }>(
    `https://ws.geonorge.no/adresser/v1/sok?kommunenummer=${nummer}&gardsnummer=${query.gnr}&bruksnummer=${query.bnr}&treffPerSide=8`,
  );
  const addresses = (addrData?.adresser ?? [])
    .map(mapAddress)
    .filter((r): r is SearchResult => r !== null);

  if (eiendom) {
    const rest = addresses.filter(
      (a) =>
        Math.abs(a.lat - eiendom.lat) > 0.00001 ||
        Math.abs(a.lng - eiendom.lng) > 0.00001,
    );
    return [eiendom, ...rest];
  }

  return addresses;
}
