import { NextResponse, type NextRequest } from "next/server";
import { parseFeatureInfoResponse } from "@/lib/featureInfoParse";
import { WMS_LAYER_MAP, resolveWmsStyles, type WmsLayerConfig } from "@/lib/wmsLayers";

export const dynamic = "force-dynamic";

interface FeatureInfoResult {
  layerId: string;
  layerName: string;
  features: Record<string, unknown>[];
}

const R = 6378137;
const CLICK_TILE = 101;
const CLICK_HALF = 50;

function toMercator(lng: number, lat: number): [number, number] {
  const x = (R * lng * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return [x, y];
}

/** Small bbox around the click point – much more reliable than full-map bbox. */
function clickBbox(lng: number, lat: number, radiusM = 80): string {
  const [cx, cy] = toMercator(lng, lat);
  return `${cx - radiusM},${cy - radiusM},${cx + radiusM},${cy + radiusM}`;
}

async function fetchWmsFeatures(
  layer: WmsLayerConfig,
  lng: number,
  lat: number,
): Promise<Record<string, unknown>[]> {
  const infoFormat = layer.wmsInfoFormat ?? "text/html";
  const params = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetFeatureInfo",
    layers: layer.queryLayers,
    query_layers: layer.queryLayers,
    srs: "EPSG:3857",
    bbox: clickBbox(lng, lat),
    width: String(CLICK_TILE),
    height: String(CLICK_TILE),
    x: String(CLICK_HALF),
    y: String(CLICK_HALF),
    info_format: infoFormat,
    feature_count: "10",
  });
  if (layer.wmsStyles != null) {
    params.set("styles", resolveWmsStyles(layer.wmsStyles, layer.queryLayers));
  } else if (layer.id === "kulturminner") {
    params.set("styles", resolveWmsStyles("", layer.queryLayers));
  }

  const res = await fetch(`${layer.url}?${params.toString()}`, {
    cache: "no-store",
  });
  const text = await res.text();
  return parseFeatureInfoResponse(text);
}

async function fetchRestFeatures(
  layer: WmsLayerConfig,
  lng: number,
  lat: number,
): Promise<Record<string, unknown>[]> {
  const cfg = layer.restQuery;
  if (!cfg) return [];

  const features: Record<string, unknown>[] = [];
  for (const layerId of cfg.layerIds) {
    const url = new URL(`${cfg.base}/${layerId}/query`);
    url.searchParams.set("geometry", `${lng},${lat}`);
    url.searchParams.set("geometryType", "esriGeometryPoint");
    url.searchParams.set("inSR", "4326");
    url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
    url.searchParams.set("outFields", cfg.outFields);
    url.searchParams.set("returnGeometry", "false");
    url.searchParams.set("f", "json");

    try {
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.error) continue;
      for (const f of data.features ?? []) {
        const attrs = f.attributes as Record<string, unknown> | undefined;
        if (attrs && Object.keys(attrs).length > 0) features.push(attrs);
      }
    } catch {
      // Try next sublayer.
    }
  }
  return features;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const id = sp.get("id");
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));

  if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Mangler id/lat/lng" }, { status: 400 });
  }

  const layer = WMS_LAYER_MAP[id];
  if (!layer || !layer.queryable) {
    return NextResponse.json({ error: "Ukjent lag" }, { status: 404 });
  }

  try {
    let features = await fetchWmsFeatures(layer, lng, lat);
    if (features.length === 0) {
      features = await fetchRestFeatures(layer, lng, lat);
    }

    const result: FeatureInfoResult = {
      layerId: layer.id,
      layerName: layer.name,
      features,
    };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Kunne ikke hente data fra karttjenesten" },
      { status: 502 },
    );
  }
}
