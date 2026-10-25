import type { GeoJsonGeometry } from "@/lib/types";

/** GeoJSON [lng, lat] → Leaflet [lat, lng]. */
export function geojsonToLeafletPositions(
  geojson: GeoJsonGeometry,
): [number, number][] {
  if (geojson.type === "LineString") {
    return geojson.coordinates.map(([lng, lat]) => [lat, lng]);
  }
  if (geojson.type === "Polygon") {
    return geojson.coordinates[0].map(([lng, lat]) => [lat, lng]);
  }
  return [];
}

/** Midtpunkt for linje/sone – brukes bl.a. til navigasjon for tegninger. */
export function geojsonCenter(
  geojson: GeoJsonGeometry,
): { lat: number; lng: number } | null {
  const positions = geojsonToLeafletPositions(geojson);
  if (positions.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const [la, ln] of positions) {
    lat += la;
    lng += ln;
  }
  return { lat: lat / positions.length, lng: lng / positions.length };
}

/** Leaflet [lat, lng] vertices → GeoJSON geometry. */
export function leafletToGeoJson(
  type: "line" | "polygon",
  vertices: [number, number][],
): GeoJsonGeometry {
  const coords = vertices.map(([lat, lng]) => [lng, lat] as [number, number]);
  if (type === "line") {
    return { type: "LineString", coordinates: coords };
  }
  // Lukk polygonringen hvis den ikke allerede er lukket.
  const ring = [...coords];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push(first);
  }
  return { type: "Polygon", coordinates: [ring] };
}
