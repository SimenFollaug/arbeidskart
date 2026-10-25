// Klient-side inngang til /api/areacheck (serveren gjør ArcGIS punkt-i-polygon
// og WMS-oppslag mot vern, fredete arter, kulturminner m.m.).

export type { AreaHit, AreaKind } from "@/app/api/areacheck/route";

import type { AreaHit } from "@/app/api/areacheck/route";

export async function checkAreaAtPoint(
  lat: number,
  lng: number,
): Promise<AreaHit[]> {
  try {
    const res = await fetch(
      `/api/areacheck?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hits as AreaHit[]) ?? [];
  } catch {
    return [];
  }
}

/** Sjekker alle hjørner (+ tyngdepunkt for soner) mot vern/naturfare. */
export async function checkAreaAtVertices(
  vertices: [number, number][],
  drawingType: "line" | "polygon",
): Promise<AreaHit[]> {
  if (vertices.length === 0) return [];
  try {
    const res = await fetch("/api/areacheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vertices,
        includeCentroid: drawingType === "polygon",
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hits as AreaHit[]) ?? [];
  } catch {
    return [];
  }
}
