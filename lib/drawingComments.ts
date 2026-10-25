import type { Comment, MapDrawing } from "@/lib/types";
import { geojsonToLeafletPositions } from "@/lib/geojson";

/** Maks avstand (meter) fra linje for at en kommentar regnes som «på» tegningen. */
const LINE_TOLERANCE_M = 50;

const R = 6378137;

function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function pointInPolygon(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointNearLineString(
  lng: number,
  lat: number,
  coords: [number, number][],
  toleranceM: number,
): boolean {
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    if (pointNearSegment(lng, lat, lng1, lat1, lng2, lat2, toleranceM)) {
      return true;
    }
  }
  return false;
}

function pointNearSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  toleranceM: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return haversineM(py, px, y1, x1) <= toleranceM;
  }
  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)),
  );
  const projLng = x1 + t * dx;
  const projLat = y1 + t * dy;
  return haversineM(py, px, projLat, projLng) <= toleranceM;
}

export function commentBelongsToDrawing(
  comment: Comment,
  drawing: MapDrawing,
): boolean {
  const geojson = drawing.geojson;
  if (geojson.type === "Polygon") {
    const ring = geojson.coordinates[0];
    return pointInPolygon(comment.lng, comment.lat, ring);
  }
  return pointNearLineString(
    comment.lng,
    comment.lat,
    geojson.coordinates,
    LINE_TOLERANCE_M,
  );
}

export function getCommentsForDrawing(
  comments: Comment[],
  drawing: MapDrawing,
): Comment[] {
  return comments.filter((c) => commentBelongsToDrawing(c, drawing));
}

export function getStandaloneComments(
  comments: Comment[],
  drawings: MapDrawing[],
): Comment[] {
  return comments.filter(
    (c) => !drawings.some((d) => commentBelongsToDrawing(c, d)),
  );
}

export function drawingCentroid(drawing: MapDrawing): {
  lat: number;
  lng: number;
} {
  const positions = geojsonToLeafletPositions(drawing.geojson);
  if (positions.length === 0) return { lat: 0, lng: 0 };
  const lat =
    positions.reduce((sum, [la]) => sum + la, 0) / positions.length;
  const lng =
    positions.reduce((sum, [, ln]) => sum + ln, 0) / positions.length;
  return { lat, lng };
}

export interface DrawingWithComments {
  drawing: MapDrawing;
  comments: Comment[];
}

export function groupDrawingsWithComments(
  comments: Comment[],
  drawings: MapDrawing[],
): DrawingWithComments[] {
  return drawings.map((drawing) => ({
    drawing,
    comments: getCommentsForDrawing(comments, drawing),
  }));
}

/** Sjekk om tegning/kommentar matcher søk og filtre. */
export function matchesFilters(
  item: {
    title: string;
    body: string | null;
    category: string;
    status?: string;
    author_name?: string | null;
  },
  search: string,
  categoryFilter: string,
  statusFilter: string,
): boolean {
  if (categoryFilter && item.category !== categoryFilter) return false;
  if (statusFilter && item.status && item.status !== statusFilter) return false;
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const hay = `${item.title} ${item.body ?? ""} ${item.author_name ?? ""}`.toLowerCase();
  return hay.includes(q);
}

export function filterDrawingGroups(
  groups: DrawingWithComments[],
  search: string,
  categoryFilter: string,
  statusFilter: string,
): DrawingWithComments[] {
  return groups
    .map(({ drawing, comments }) => {
      const drawingMatches = matchesFilters(
        drawing,
        search,
        categoryFilter,
        "",
      );
      const filteredComments = comments.filter((c) =>
        matchesFilters(c, search, categoryFilter, statusFilter),
      );
      if (!drawingMatches && filteredComments.length === 0) return null;
      return {
        drawing,
        comments: drawingMatches
          ? comments.filter((c) =>
              matchesFilters(c, search, categoryFilter, statusFilter),
            )
          : filteredComments,
      };
    })
    .filter((g): g is DrawingWithComments => g !== null);
}
