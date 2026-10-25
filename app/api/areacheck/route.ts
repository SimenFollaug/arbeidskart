import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export type AreaKind = "protected" | "hazard";

export interface AreaHit {
  layerId: string;
  layerName: string;
  kind: AreaKind;
  name: string | null;
}

interface ArcgisCheck {
  id: string;
  name: string;
  kind: AreaKind;
  restBase: string;
  layerIds: number[];
  outFields: string;
  nameFields: string[];
}

const ARCGIS_CHECKS: ArcgisCheck[] = [
  {
    id: "verneomrader",
    name: "Naturvernområder",
    kind: "protected",
    restBase:
      "https://kart.miljodirektoratet.no/arcgis/rest/services/vern/MapServer",
    layerIds: [0],
    outFields: "navn,verneform,verneplan",
    nameFields: ["navn", "verneform", "verneplan"],
  },
  {
    id: "utvalgte_naturtyper",
    name: "Utvalgte naturtyper",
    kind: "protected",
    restBase:
      "https://kart.miljodirektoratet.no/arcgis/rest/services/naturtyper_utvalgte2/MapServer",
    layerIds: [0],
    outFields: "UtvalgtNaturtype,UtvalgtNaturtypeKode",
    nameFields: ["UtvalgtNaturtype", "UtvalgtNaturtypeKode"],
  },
  {
    id: "fredete_arter",
    name: "Fredete arter",
    kind: "protected",
    restBase:
      "https://arcgis002.miljodirektoratet.no/arcgis/rest/services/artnasjonal3/MapServer",
    layerIds: [8, 9],
    outFields: "norsk_navn,vitenskapelig_navn,artsgruppe",
    nameFields: ["norsk_navn", "vitenskapelig_navn", "artsgruppe"],
  },
  {
    id: "kvikkleire",
    name: "Kvikkleiresoner",
    kind: "hazard",
    restBase:
      "https://kart.nve.no/enterprise/rest/services/SkredKvikkleire2/MapServer",
    layerIds: [0, 1, 2],
    outFields: "faregrad,risiko",
    nameFields: ["faregrad", "risiko"],
  },
  {
    id: "skredfaresoner",
    name: "Skredfaresoner",
    kind: "hazard",
    restBase:
      "https://kart.nve.no/enterprise/rest/services/Skredfaresoner3/MapServer",
    layerIds: [6, 7, 8, 10, 11, 12],
    outFields: "skredtype,skredsannsynlighet,objekttype",
    nameFields: ["objekttype", "skredtype", "skredsannsynlighet"],
  },
  {
    id: "flom_erosjon",
    name: "Flom- og erosjonsfare",
    kind: "hazard",
    restBase:
      "https://kart.nve.no/enterprise/rest/services/Flomaktsomhet/MapServer",
    layerIds: [1],
    outFields: "objekttype,vassomr,opphav",
    nameFields: ["objekttype", "vassomr"],
  },
];

const R = 6378137;

function toMercator(lng: number, lat: number): [number, number] {
  const x = (R * lng * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return [x, y];
}

function pickName(
  attrs: Record<string, unknown>,
  fields: string[],
): string | null {
  for (const f of fields) {
    const v = attrs[f];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null && String(v).trim() !== "") return `${k}: ${v}`;
  }
  return null;
}

async function queryArcGisLayer(
  cfg: ArcgisCheck,
  layerId: number,
  lng: number,
  lat: number,
): Promise<Record<string, unknown> | null> {
  const url = new URL(`${cfg.restBase}/${layerId}/query`);
  url.searchParams.set("geometry", `${lng},${lat}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("outFields", cfg.outFields);
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const attrs = data.features?.[0]?.attributes as
      | Record<string, unknown>
      | undefined;
    return attrs ?? null;
  } catch {
    return null;
  }
}

async function queryKulturminner(
  lng: number,
  lat: number,
): Promise<AreaHit | null> {
  const [cx, cy] = toMercator(lng, lat);
  const d = 50;
  const bbox = `${cx - d},${cy - d},${cx + d},${cy + d}`;
  const params = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetFeatureInfo",
    layers: "Lokaliteter,Enkeltminner,Sikringssoner",
    query_layers: "Lokaliteter,Enkeltminner,Sikringssoner",
    styles: "default",
    srs: "EPSG:3857",
    bbox,
    width: "101",
    height: "101",
    x: "50",
    y: "50",
    info_format: "text/html",
    feature_count: "5",
  });

  try {
    const res = await fetch(
      `https://kart.ra.no/wms/kulturminner2?${params.toString()}`,
      { cache: "no-store" },
    );
    const html = await res.text();
    const rows = parseHtmlTable(html);
    if (rows.length === 0) return null;

    const name =
      pickName(rows[0], [
        "lokalitetsnavn",
        "navn",
        "kulturminne",
        "kategori",
      ]) ?? "Kulturminne";

    return {
      layerId: "kulturminner",
      layerName: "Kulturminner",
      kind: "protected",
      name,
    };
  } catch {
    return null;
  }
}

function parseHtmlTable(html: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const rowPattern = /<tr[^>]*>(.*?)<\/tr>/gis;
  const cellPattern = /<t[hd][^>]*>(.*?)<\/t[hd]>/gis;
  let rowMatch: RegExpExecArray | null;
  let headers: string[] | null = null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length === 0) continue;
    if (!headers) {
      headers = cells;
    } else {
      const obj: Record<string, unknown> = {};
      cells.forEach((c, i) => {
        obj[headers![i] ?? `felt_${i}`] = c;
      });
      if (Object.values(obj).some((v) => String(v).trim() !== "")) {
        rows.push(obj);
      }
    }
  }
  return rows;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

async function checkPointAt(lng: number, lat: number): Promise<AreaHit[]> {
  const hits: AreaHit[] = [];

  const arcgisResults = await Promise.all(
    ARCGIS_CHECKS.map(async (cfg) => {
      for (const layerId of cfg.layerIds) {
        const attrs = await queryArcGisLayer(cfg, layerId, lng, lat);
        if (attrs) {
          return {
            layerId: cfg.id,
            layerName: cfg.name,
            kind: cfg.kind,
            name: pickName(attrs, cfg.nameFields),
          } satisfies AreaHit;
        }
      }
      return null;
    }),
  );

  for (const hit of arcgisResults) {
    if (hit) hits.push(hit);
  }

  const kultur = await queryKulturminner(lng, lat);
  if (kultur) hits.push(kultur);

  return hits;
}

function mergeHits(all: AreaHit[][]): AreaHit[] {
  const map = new Map<string, AreaHit>();
  for (const hits of all) {
    for (const h of hits) {
      const prev = map.get(h.layerId);
      if (!prev || (!prev.name && h.name)) map.set(h.layerId, h);
    }
  }
  return Array.from(map.values());
}

function sampleVertices(
  vertices: [number, number][],
  includeCentroid: boolean,
): [number, number][] {
  const pts = [...vertices];
  if (includeCentroid && vertices.length >= 3) {
    const lat = vertices.reduce((s, [la]) => s + la, 0) / vertices.length;
    const lng = vertices.reduce((s, [, ln]) => s + ln, 0) / vertices.length;
    pts.push([lat, lng]);
  }
  return pts;
}

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Mangler lat/lng" }, { status: 400 });
  }

  const hits = await checkPointAt(lng, lat);
  return NextResponse.json({ hits });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const vertices = (body as { vertices?: unknown }).vertices;
  if (!Array.isArray(vertices) || vertices.length === 0) {
    return NextResponse.json({ error: "Mangler vertices" }, { status: 400 });
  }

  const parsed: [number, number][] = [];
  for (const v of vertices) {
    if (!Array.isArray(v) || v.length < 2) continue;
    const lat = Number(v[0]);
    const lng = Number(v[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) parsed.push([lat, lng]);
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: "Ingen gyldige punkter" }, { status: 400 });
  }

  const includeCentroid = Boolean(
    (body as { includeCentroid?: boolean }).includeCentroid,
  );
  const samples = sampleVertices(parsed, includeCentroid);

  const perPoint = await Promise.all(
    samples.map(([lat, lng]) => checkPointAt(lng, lat)),
  );

  return NextResponse.json({ hits: mergeHits(perPoint) });
}
