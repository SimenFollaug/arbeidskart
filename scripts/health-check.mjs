/**
 * One-off health check for external map services and ArcGIS field names.
 * Run: node scripts/health-check.mjs
 */

const WMS_LAYERS = [
  { id: "verneomrader", url: "https://kart.miljodirektoratet.no/arcgis/services/vern/MapServer/WMSServer", layers: "naturvern_omrade" },
  { id: "utvalgte_naturtyper", url: "https://kart.miljodirektoratet.no/arcgis/services/naturtyper_utvalgte2/MapServer/WMSServer", layers: "naturtype_utvalgt_omr", wmsStyles: "default" },
  { id: "fredete_arter", url: "https://arcgis002.miljodirektoratet.no/arcgis/services/artnasjonal3/MapServer/WMSServer", layers: "fredete_arter_omr,fredete_arter_pkt" },
  { id: "hogstklasser", url: "https://wms.nibio.no/cgi-bin/skogbruksplan?", layers: "hogstklasser", wmsStyles: "default" },
  { id: "mis", url: "https://wms.nibio.no/cgi-bin/mis?", layers: "Livsmiljo_flate", wmsStyles: "default" },
  { id: "kulturminner", url: "https://kart.ra.no/wms/kulturminner2", layers: "Lokalitetsikoner" },
  { id: "kvikkleire", url: "https://kart.nve.no/enterprise/services/SkredKvikkleire2/MapServer/WMSServer", layers: "KvikkleireKartlagtOmrade,KvikkleireRisiko" },
  { id: "skredfaresoner", url: "https://kart.nve.no/enterprise/services/Skredfaresoner3/MapServer/WMSServer", layers: "Skredfaresone_100", wmsStyles: "default" },
  { id: "flom_erosjon", url: "https://kart.nve.no/enterprise/services/Flomaktsomhet/MapServer/WMSServer", layers: "Flom_aktsomhetsomrade", wmsStyles: "default" },
  { id: "eiendom", url: "https://wms.geonorge.no/skwms1/wms.matrikkelkart", layers: "teig" },
  { id: "stromnett_overforing", url: "https://kart.nve.no/enterprise/services/Nettanlegg4/MapServer/WMSServer", layers: "Transmisjonsnett_luftledning43179" },
  { id: "stromnett_hsp", url: "https://kart.nve.no/enterprise/services/Nettanlegg4/MapServer/WMSServer", layers: "Distribusjonsnett", wmsStyles: "default" },
];

const R = 6378137;
function mercatorBbox(lng, lat, d = 5000) {
  const x = (R * lng * Math.PI) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return `${x - d},${y - d},${x + d},${y + d}`;
}

const OSLO = { lng: 10.75, lat: 59.91 };

async function testWms(layer) {
  const styles = layer.wmsStyles ?? "";
  const bbox = mercatorBbox(OSLO.lng, OSLO.lat);
  const params = new URLSearchParams({
    service: "WMS",
    request: "GetMap",
    version: "1.3.0",
    layers: layer.layers.split(",")[0],
    styles,
    crs: "EPSG:3857",
    bbox,
    width: "256",
    height: "256",
    format: "image/png",
    transparent: "true",
  });
  const url = `${layer.url}?${params}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const buf = Buffer.from(await res.arrayBuffer());
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    const isXml = buf.slice(0, 5).toString("utf8").includes("<?xml");
    return {
      id: layer.id,
      ok: res.ok && isPng && !isXml,
      status: res.status,
      bytes: buf.length,
      detail: isXml ? buf.slice(0, 200).toString("utf8") : isPng ? "PNG" : "unknown",
    };
  } catch (e) {
    return { id: layer.id, ok: false, detail: String(e) };
  }
}

const ARCGIS_CHECKS = [
  {
    id: "verneomrader",
    restBase: "https://kart.miljodirektoratet.no/arcgis/rest/services/vern/MapServer",
    layerId: 0,
    outFields: "navn,verneform,verneplan",
    point: { lng: 10.75, lat: 59.91 },
  },
  {
    id: "utvalgte_naturtyper",
    restBase:
      "https://kart.miljodirektoratet.no/arcgis/rest/services/naturtyper_utvalgte2/MapServer",
    layerId: 0,
    outFields: "UtvalgtNaturtype,UtvalgtNaturtypeKode",
    point: { lng: 10.7307, lat: 59.8539 },
  },
  {
    id: "fredete_arter",
    restBase: "https://arcgis002.miljodirektoratet.no/arcgis/rest/services/artnasjonal3/MapServer",
    layerId: 8,
    outFields: "norsk_navn,vitenskapelig_navn,artsgruppe",
    point: { lng: 10.75, lat: 59.91 },
  },
  {
    id: "kvikkleire",
    restBase: "https://kart.nve.no/enterprise/rest/services/SkredKvikkleire2/MapServer",
    layerId: 1,
    outFields: "faregrad,risiko",
    point: { lng: 5.32, lat: 60.39 },
  },
  {
    id: "skredfaresoner",
    restBase: "https://kart.nve.no/enterprise/rest/services/Skredfaresoner3/MapServer",
    layerId: 6,
    outFields: "skredtype,skredsannsynlighet,objekttype",
    point: { lng: 6.7658, lat: 58.6409 },
  },
  {
    id: "flom_erosjon",
    restBase: "https://kart.nve.no/enterprise/rest/services/Flomaktsomhet/MapServer",
    layerId: 1,
    outFields: "objekttype,vassomr",
    point: { lng: 10.75, lat: 59.91 },
  },
];

async function testArcGis(cfg) {
  const url = new URL(`${cfg.restBase}/${cfg.layerId}/query`);
  url.searchParams.set("geometry", `${cfg.point.lng},${cfg.point.lat}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("outFields", cfg.outFields);
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const data = await res.json();
    if (data.error) {
      return { id: cfg.id, ok: false, detail: data.error.message };
    }
    return {
      id: cfg.id,
      ok: true,
      features: data.features?.length ?? 0,
      sample: data.features?.[0]?.attributes ?? null,
    };
  } catch (e) {
    return { id: cfg.id, ok: false, detail: String(e) };
  }
}

console.log("=== WMS GetMap (Oslo bbox, first sublayer) ===");
const wmsResults = await Promise.all(WMS_LAYERS.map(testWms));
for (const r of wmsResults) {
  console.log(r.ok ? "OK" : "FAIL", r.id, r.status ?? "", r.bytes ?? "", r.detail ?? "");
}

console.log("\n=== ArcGIS REST field queries ===");
const arcResults = await Promise.all(ARCGIS_CHECKS.map(testArcGis));
for (const r of arcResults) {
  console.log(
    r.ok ? "OK" : "FAIL",
    r.id,
    r.features != null ? `features=${r.features}` : "",
    r.detail ?? JSON.stringify(r.sample)?.slice(0, 80) ?? "",
  );
}

const fails = [...wmsResults.filter((r) => !r.ok), ...arcResults.filter((r) => !r.ok)];
process.exitCode = fails.length ? 1 : 0;
console.log(`\n${fails.length} failure(s)`);
