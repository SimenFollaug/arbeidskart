export interface ImportedRouteSegment {
  positions: [number, number][];
}

export interface ImportedWaypoint {
  lat: number;
  lng: number;
  name?: string;
}

export interface ImportedRoute {
  id: string;
  name: string;
  segments: ImportedRouteSegment[];
  waypoints: ImportedWaypoint[];
  visible: boolean;
  color: string;
  source: "gpx" | "kml";
  importedAt: string;
}

const ROUTE_COLORS = ["#0891b2", "#ea580c", "#7c3aed", "#059669", "#db2777"];

function nextColor(index: number): string {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

function uid(): string {
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseCoordPair(lng: number, lat: number): [number, number] | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

function parseKmlCoordinates(text: string): [number, number][] {
  const out: [number, number][] = [];
  for (const token of text.trim().split(/\s+/)) {
    if (!token) continue;
    const parts = token.split(",").map((p) => Number(p.trim()));
    if (parts.length < 2) continue;
    const pair = parseCoordPair(parts[0], parts[1]);
    if (pair) out.push(pair);
  }
  return out;
}

function getKmlName(node: Element, fallback: string): string {
  const name =
    node.querySelector(":scope > name")?.textContent?.trim() ||
    node.querySelector(":scope > Name")?.textContent?.trim();
  return name || fallback;
}

function kmlLineStrings(doc: Document): ImportedRouteSegment[] {
  const segments: ImportedRouteSegment[] = [];
  doc.querySelectorAll("LineString coordinates, linestring coordinates").forEach((el) => {
    const positions = parseKmlCoordinates(el.textContent ?? "");
    if (positions.length >= 2) segments.push({ positions });
  });
  return segments;
}

function kmlPolygons(doc: Document): ImportedRouteSegment[] {
  const segments: ImportedRouteSegment[] = [];
  doc
    .querySelectorAll(
      "Polygon outerBoundaryIs LinearRing coordinates, polygon outerboundaryis linearring coordinates",
    )
    .forEach((el) => {
      const positions = parseKmlCoordinates(el.textContent ?? "");
      if (positions.length >= 3) segments.push({ positions });
    });
  return segments;
}

function kmlWaypoints(doc: Document): ImportedWaypoint[] {
  const out: ImportedWaypoint[] = [];
  doc.querySelectorAll("Placemark Point coordinates, placemark point coordinates").forEach((el) => {
    const positions = parseKmlCoordinates(el.textContent ?? "");
    const first = positions[0];
    if (!first) return;
    const placemark = el.closest("Placemark, placemark");
    const name = placemark ? getKmlName(placemark, "Punkt") : "Punkt";
    out.push({ lat: first[0], lng: first[1], name });
  });
  return out;
}

export function parseKml(text: string): ImportedRoute[] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Ugyldig KML-fil");
  }

  const routes: ImportedRoute[] = [];
  const placemarks = doc.querySelectorAll("Placemark, placemark");

  if (placemarks.length > 0) {
    placemarks.forEach((pm, index) => {
      const segments: ImportedRouteSegment[] = [];
      pm.querySelectorAll("LineString coordinates, linestring coordinates").forEach((el) => {
        const positions = parseKmlCoordinates(el.textContent ?? "");
        if (positions.length >= 2) segments.push({ positions });
      });
      pm.querySelectorAll(
        "Polygon outerBoundaryIs LinearRing coordinates, polygon outerboundaryis linearring coordinates",
      ).forEach((el) => {
        const positions = parseKmlCoordinates(el.textContent ?? "");
        if (positions.length >= 3) segments.push({ positions });
      });

      const pointEl = pm.querySelector("Point coordinates, point coordinates");
      const waypoints: ImportedWaypoint[] = [];
      if (pointEl) {
        const positions = parseKmlCoordinates(pointEl.textContent ?? "");
        const first = positions[0];
        if (first) {
          waypoints.push({
            lat: first[0],
            lng: first[1],
            name: getKmlName(pm, "Punkt"),
          });
        }
      }

      if (segments.length === 0 && waypoints.length === 0) return;

      routes.push({
        id: uid(),
        name: getKmlName(pm, `KML ${index + 1}`),
        segments,
        waypoints,
        visible: true,
        color: nextColor(index),
        source: "kml",
        importedAt: new Date().toISOString(),
      });
    });
  }

  if (routes.length > 0) return routes;

  const segments = [...kmlLineStrings(doc), ...kmlPolygons(doc)];
  const waypoints = kmlWaypoints(doc);
  if (segments.length === 0 && waypoints.length === 0) {
    throw new Error("Fant ingen linjer eller punkter i KML-filen");
  }

  return [
    {
      id: uid(),
      name: doc.querySelector("Document name, document name")?.textContent?.trim() || "KML-import",
      segments,
      waypoints,
      visible: true,
      color: nextColor(0),
      source: "kml",
      importedAt: new Date().toISOString(),
    },
  ];
}

function gpxPoints(selector: string, parent: ParentNode): [number, number][] {
  const out: [number, number][] = [];
  parent.querySelectorAll(selector).forEach((pt) => {
    const lat = Number(pt.getAttribute("lat"));
    const lng = Number(pt.getAttribute("lon"));
    const pair = parseCoordPair(lng, lat);
    if (pair) out.push(pair);
  });
  return out;
}

export function parseGpx(text: string): ImportedRoute[] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Ugyldig GPX-fil");
  }

  const routes: ImportedRoute[] = [];
  let colorIndex = 0;

  doc.querySelectorAll("trk").forEach((trk, index) => {
    const segments: ImportedRouteSegment[] = [];
    trk.querySelectorAll("trkseg").forEach((seg) => {
      const positions = gpxPoints("trkpt", seg);
      if (positions.length >= 2) segments.push({ positions });
    });
    if (segments.length === 0) return;
    routes.push({
      id: uid(),
      name: getKmlName(trk, `Spor ${index + 1}`),
      segments,
      waypoints: [],
      visible: true,
      color: nextColor(colorIndex++),
      source: "gpx",
      importedAt: new Date().toISOString(),
    });
  });

  doc.querySelectorAll("rte").forEach((rte, index) => {
    const positions = gpxPoints("rtept", rte);
    if (positions.length < 2) return;
    routes.push({
      id: uid(),
      name: getKmlName(rte, `Rute ${index + 1}`),
      segments: [{ positions }],
      waypoints: [],
      visible: true,
      color: nextColor(colorIndex++),
      source: "gpx",
      importedAt: new Date().toISOString(),
    });
  });

  const waypoints: ImportedWaypoint[] = [];
  doc.querySelectorAll("wpt").forEach((wpt) => {
    const lat = Number(wpt.getAttribute("lat"));
    const lng = Number(wpt.getAttribute("lon"));
    const pair = parseCoordPair(lng, lat);
    if (!pair) return;
    waypoints.push({
      lat: pair[0],
      lng: pair[1],
      name: getKmlName(wpt, "Veipunkt"),
    });
  });

  if (routes.length === 0 && waypoints.length > 0) {
    routes.push({
      id: uid(),
      name: doc.querySelector("metadata name")?.textContent?.trim() || "GPX-punkter",
      segments: [],
      waypoints,
      visible: true,
      color: nextColor(0),
      source: "gpx",
      importedAt: new Date().toISOString(),
    });
  }

  if (routes.length === 0) {
    throw new Error("Fant ingen spor eller ruter i GPX-filen");
  }

  return routes;
}

export function parseRouteFile(text: string, filename: string): ImportedRoute[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".gpx")) return parseGpx(text);
  if (lower.endsWith(".kml") || lower.endsWith(".kmz")) {
    if (lower.endsWith(".kmz")) {
      throw new Error("KMZ må pakkes ut til KML før import");
    }
    return parseKml(text);
  }
  if (text.includes("<gpx")) return parseGpx(text);
  if (text.includes("<kml") || text.includes("<Kml")) return parseKml(text);
  throw new Error("Ukjent filtype – bruk .gpx eller .kml");
}

/** Alle koordinater i importerte ruter (for zoom til utstrekning). */
export function routeBounds(
  routes: ImportedRoute[],
): [[number, number], [number, number]] | null {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;

  function add(lat: number, lng: number) {
    minLat = Math.min(minLat, lat);
    minLng = Math.min(minLng, lng);
    maxLat = Math.max(maxLat, lat);
    maxLng = Math.max(maxLng, lng);
  }

  for (const route of routes) {
    for (const seg of route.segments) {
      for (const [lat, lng] of seg.positions) add(lat, lng);
    }
    for (const wp of route.waypoints) add(wp.lat, wp.lng);
  }

  if (!Number.isFinite(minLat)) return null;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}
