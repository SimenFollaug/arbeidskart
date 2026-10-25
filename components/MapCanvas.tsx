"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  Polygon,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { Comment, DeletedComment, DrawMode, MapDrawing } from "@/lib/types";
import type { ImportedRoute } from "@/lib/importRoute";
import { BACKGROUND_LAYERS, WMS_LAYER_MAP, buildLineSld, resolveWmsStyles } from "@/lib/wmsLayers";
import { categoryColor, categoryLabel, statusLabel } from "@/lib/categories";
import { buildCommentMarkerHtml } from "@/lib/commentMarker";
import { geojsonToLeafletPositions, geojsonCenter } from "@/lib/geojson";
import { JobActions, type JobAction } from "@/components/JobActions";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/mapDefaults";

export interface QueryClick {
  bbox: string;
  width: number;
  height: number;
  x: number;
  y: number;
  lat: number;
  lng: number;
}

interface MapCanvasProps {
  backgroundId: string;
  enabledLayers: { id: string; opacity: number }[];
  comments: Comment[];
  deletedComments: DeletedComment[];
  showDeleted: boolean;
  drawings: MapDrawing[];
  showDrawings: boolean;
  importedRoutes: ImportedRoute[];
  fitBounds: [[number, number], [number, number]] | null;
  fitBoundsKey: number;
  addMode: boolean;
  drawMode: DrawMode;
  drawVertices: [number, number][];
  selectedId: string | null;
  selectedDrawingId: string | null;
  flyTo: { lat: number; lng: number; key: number } | null;
  onAddAt: (lat: number, lng: number) => void;
  onDrawVertex: (lat: number, lng: number) => void;
  onQueryAt: (q: QueryClick) => void;
  onSelectComment: (id: string) => void;
  onEditComment: (comment: Comment) => void;
  onDeleteComment: (comment: Comment) => void;
  onDeleteDrawing: (drawing: MapDrawing) => void;
  onJobAction: (
    kind: "comment" | "drawing",
    action: JobAction,
    id: string,
  ) => void;
  currentUserId: string;
  isAdmin: boolean;
  geolocateSlot: HTMLDivElement | null;
}

/** A short "shared with" label for popups, shown for restricted items. */
function AudienceNote({
  audience,
  recipients,
}: {
  audience: MapDrawing["audience"];
  recipients: MapDrawing["recipients"];
}) {
  if (audience !== "selected") return null;
  const names = recipients.map((r) => r.name ?? "Ukjent").join(", ");
  return (
    <p className="mt-1 text-xs text-amber-600">
      Delt med: {names || "kun deg"}
    </p>
  );
}

function FlyToBounds({
  bounds,
  trigger,
}: {
  bounds: [[number, number], [number, number]] | null;
  trigger: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
  }, [map, bounds, trigger]);
  return null;
}

/** Tvinger startvisning – MapContainer alene holder ikke alltid ved remount/dynamic import. */
function InitialView() {
  const map = useMap();
  useEffect(() => {
    map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, { animate: false });
  }, [map]);
  return null;
}

function markerIcon(comment: Comment, selected: boolean): L.DivIcon {
  const important = comment.status === "viktig";
  return L.divIcon({
    className: "",
    html: buildCommentMarkerHtml(comment.category, selected, important),
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });
}

const deletedIcon: L.DivIcon = L.divIcon({
  className: "",
  html: `<div class="del-marker"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
  popupAnchor: [0, -22],
});

function DrawingPopup({
  drawing,
  onDelete,
  canManage,
  currentUserId,
  isAdmin,
  onJobAction,
}: {
  drawing: MapDrawing;
  onDelete: (d: MapDrawing) => void;
  canManage: boolean;
  currentUserId: string;
  isAdmin: boolean;
  onJobAction: (
    kind: "comment" | "drawing",
    action: JobAction,
    id: string,
  ) => void;
}) {
  return (
    <div className="min-w-[180px]">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ background: categoryColor(drawing.category) }}
        />
        <strong className="text-sm">{drawing.title}</strong>
      </div>
      {drawing.body && (
        <p className="mt-1 text-sm text-slate-600">{drawing.body}</p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        {categoryLabel(drawing.category)} ·{" "}
        {drawing.drawing_type === "polygon" ? "Sone" : "Linje"}
      </p>
      <p className="text-xs text-slate-400">
        {drawing.author_name ?? "Ukjent"} ·{" "}
        {new Date(drawing.created_at).toLocaleString("no-NO", {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </p>
      <AudienceNote audience={drawing.audience} recipients={drawing.recipients} />
      <JobActions
        item={drawing}
        lat={geojsonCenter(drawing.geojson)?.lat}
        lng={geojsonCenter(drawing.geojson)?.lng}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onAction={(action) => onJobAction("drawing", action, drawing.id)}
      />
      {canManage && (
        <button
          onClick={() => onDelete(drawing)}
          className="mt-2 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
        >
          Slett tegning
        </button>
      )}
    </div>
  );
}

function ClickHandler({
  addMode,
  drawMode,
  onAddAt,
  onDrawVertex,
  onQueryAt,
}: Pick<
  MapCanvasProps,
  "addMode" | "drawMode" | "onAddAt" | "onDrawVertex" | "onQueryAt"
>) {
  useMapEvents({
    click(e) {
      const map = e.target as L.Map;
      const { lat, lng } = e.latlng;
      if (drawMode) {
        onDrawVertex(lat, lng);
        return;
      }
      if (addMode) {
        onAddAt(lat, lng);
        return;
      }
      const crs = map.options.crs!;
      const size = map.getSize();
      const bounds = map.getBounds();
      const sw = crs.project(bounds.getSouthWest());
      const ne = crs.project(bounds.getNorthEast());
      const pt = map.latLngToContainerPoint(e.latlng);
      onQueryAt({
        bbox: `${sw.x},${sw.y},${ne.x},${ne.y}`,
        width: Math.round(size.x),
        height: Math.round(size.y),
        x: Math.round(pt.x),
        y: Math.round(pt.y),
        lat,
        lng,
      });
    },
  });
  return null;
}

function FlyTo({ target }: { target: MapCanvasProps["flyTo"] }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16), {
        duration: 0.8,
      });
    }
  }, [target, map]);
  return null;
}

function CursorMode({
  addMode,
  drawMode,
}: {
  addMode: boolean;
  drawMode: DrawMode;
}) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = addMode || drawMode ? "crosshair" : "";
    return () => {
      container.style.cursor = "";
    };
  }, [addMode, drawMode, map]);
  return null;
}

const userLocationIcon = L.divIcon({
  className: "",
  html: `<div class="user-loc"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface UserPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

function LocateControl({ slot }: { slot: HTMLDivElement | null }) {
  const map = useMap();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<UserPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep clicks on the button from being treated as map clicks.
  useEffect(() => {
    if (buttonRef.current) {
      L.DomEvent.disableClickPropagation(buttonRef.current);
      L.DomEvent.disableScrollPropagation(buttonRef.current);
    }
  }, []);

  function locate() {
    if (!("geolocation" in navigator)) {
      setError("Posisjon støttes ikke i denne nettleseren.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude, longitude, accuracy } = p.coords;
        setPos({ lat: latitude, lng: longitude, accuracy });
        map.flyTo([latitude, longitude], Math.max(map.getZoom(), 16), {
          duration: 0.8,
        });
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError(
            "Posisjon avslått. Tillat posisjon for dette nettstedet i nettleseren.",
          );
        } else if (err.code === err.TIMEOUT) {
          setError("Fant ikke posisjonen i tide. Prøv igjen.");
        } else {
          setError("Kunne ikke hente posisjonen din.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
    );
  }

  const controls = (
    <>
      {error && (
        <div className="max-w-full rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-white shadow-lg">
          {error}
        </div>
      )}
      <button
        ref={buttonRef}
        onClick={locate}
        disabled={loading}
        aria-label="Vis min posisjon"
        title="Vis min posisjon"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-lg transition hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? (
          <svg
            className="h-5 w-5 animate-spin text-blue-600"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        )}
      </button>
    </>
  );

  return (
    <>
      {slot && createPortal(controls, slot)}

      {pos && (
        <>
          <Circle
            center={[pos.lat, pos.lng]}
            radius={pos.accuracy}
            pathOptions={{
              color: "#2563eb",
              fillColor: "#2563eb",
              fillOpacity: 0.12,
              weight: 1,
            }}
          />
          <Marker position={[pos.lat, pos.lng]} icon={userLocationIcon}>
            <Popup>Du er her (±{Math.round(pos.accuracy)} m)</Popup>
          </Marker>
        </>
      )}
    </>
  );
}

export default function MapCanvas(props: MapCanvasProps) {
  const {
    backgroundId,
    enabledLayers,
    comments,
    deletedComments,
    showDeleted,
    drawings,
    showDrawings,
    importedRoutes,
    fitBounds,
    fitBoundsKey,
    addMode,
    drawMode,
    drawVertices,
    selectedId,
    selectedDrawingId,
    flyTo,
    onAddAt,
    onDrawVertex,
    onQueryAt,
    onSelectComment,
    onEditComment,
    onDeleteComment,
    onDeleteDrawing,
    onJobAction,
    currentUserId,
    isAdmin,
    geolocateSlot,
  } = props;

  const canManage = (ownerId: string) => ownerId === currentUserId || isAdmin;

  const background =
    BACKGROUND_LAYERS.find((b) => b.id === backgroundId) ?? BACKGROUND_LAYERS[0];

  const icons = useMemo(
    () =>
      new Map(
        comments.map((c) => [c.id, markerIcon(c, c.id === selectedId)] as const),
      ),
    [comments, selectedId],
  );

  return (
    <MapContainer
      center={DEFAULT_MAP_CENTER}
      zoom={DEFAULT_MAP_ZOOM}
      maxZoom={20}
      className="h-full w-full"
      zoomControl={true}
    >
      <InitialView />
      <TileLayer
        key={background.id}
        url={background.url}
        maxZoom={background.maxZoom ?? 20}
        attribution={background.attribution}
      />

      {enabledLayers.flatMap((l, layerIndex) => {
        const cfg = WMS_LAYER_MAP[l.id];
        if (!cfg) return [];
        const tiles = cfg.subLayers?.length
          ? cfg.subLayers
          : [{ layers: cfg.layers }];

        return tiles.map((sub, subIndex) => {
          const sldBody = sub.strokeColor
            ? buildLineSld(sub.layers, sub.strokeColor, sub.strokeWidth ?? 2.5)
            : undefined;

          return (
            <WMSTileLayer
              key={`${l.id}-${sub.layers}`}
              url={cfg.url}
              layers={sub.layers}
              styles={resolveWmsStyles(cfg.wmsStyles, sub.layers)}
              format={cfg.format}
              transparent={true}
              version="1.3.0"
              opacity={l.opacity}
              zIndex={10 + layerIndex * 20 + subIndex}
              attribution={subIndex === 0 ? cfg.attribution : undefined}
              className={sub.className}
              {...(sldBody ? { SLD_BODY: sldBody } : {})}
            />
          );
        });
      })}

      <ClickHandler
        addMode={addMode}
        drawMode={drawMode}
        onAddAt={onAddAt}
        onDrawVertex={onDrawVertex}
        onQueryAt={onQueryAt}
      />
      <FlyTo target={flyTo} />
      <FlyToBounds bounds={fitBounds} trigger={fitBoundsKey} />
      <CursorMode addMode={addMode} drawMode={drawMode} />
      <LocateControl slot={geolocateSlot} />

      {showDrawings &&
        drawings.map((d) => {
          const positions = geojsonToLeafletPositions(d.geojson);
          if (positions.length < 2) return null;
          const color = categoryColor(d.category);
          const selected = d.id === selectedDrawingId;
          if (d.drawing_type === "line") {
            return (
              <Polyline
                key={d.id}
                positions={positions}
                pathOptions={{
                  color,
                  weight: selected ? 6 : 4,
                  opacity: selected ? 1 : 0.9,
                }}
              >
                <Popup>
                  <DrawingPopup
                    drawing={d}
                    onDelete={onDeleteDrawing}
                    canManage={canManage(d.user_id)}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    onJobAction={onJobAction}
                  />
                </Popup>
              </Polyline>
            );
          }
          return (
            <Polygon
              key={d.id}
              positions={positions}
              pathOptions={{
                color,
                weight: selected ? 4 : 2,
                fillColor: color,
                fillOpacity: selected ? 0.35 : 0.25,
              }}
            >
              <Popup>
                <DrawingPopup
                  drawing={d}
                  onDelete={onDeleteDrawing}
                  canManage={canManage(d.user_id)}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onJobAction={onJobAction}
                />
              </Popup>
            </Polygon>
          );
        })}

      {importedRoutes
        .filter((route) => route.visible)
        .flatMap((route) => {
          const items: ReactNode[] = [];
          route.segments.forEach((seg, segIndex) => {
            if (seg.positions.length < 2) return;
            const closed =
              seg.positions.length >= 3 &&
              seg.positions[0][0] === seg.positions.at(-1)![0] &&
              seg.positions[0][1] === seg.positions.at(-1)![1];
            if (closed) {
              items.push(
                <Polygon
                  key={`${route.id}-seg-${segIndex}`}
                  positions={seg.positions}
                  pathOptions={{
                    color: route.color,
                    weight: 3,
                    dashArray: "8,6",
                    fillColor: route.color,
                    fillOpacity: 0.08,
                  }}
                />,
              );
            } else {
              items.push(
                <Polyline
                  key={`${route.id}-seg-${segIndex}`}
                  positions={seg.positions}
                  pathOptions={{
                    color: route.color,
                    weight: 4,
                    opacity: 0.95,
                    dashArray: "8,6",
                  }}
                />,
              );
            }
          });
          route.waypoints.forEach((wp, wpIndex) => {
            items.push(
              <CircleMarker
                key={`${route.id}-wp-${wpIndex}`}
                center={[wp.lat, wp.lng]}
                radius={6}
                pathOptions={{
                  color: route.color,
                  fillColor: "#fff",
                  fillOpacity: 1,
                  weight: 3,
                }}
              >
                {wp.name && (
                  <Popup>
                    <span className="text-sm">{wp.name}</span>
                  </Popup>
                )}
              </CircleMarker>,
            );
          });
          return items;
        })}

      {drawMode && drawVertices.length > 0 && (
        <>
          {drawVertices.map((p, i) => (
            <CircleMarker
              key={`dv-${i}`}
              center={p}
              radius={5}
              pathOptions={{
                color: "#7c3aed",
                fillColor: "#fff",
                fillOpacity: 1,
                weight: 2,
              }}
            />
          ))}
          {drawMode === "line" && drawVertices.length >= 2 && (
            <Polyline
              positions={drawVertices}
              pathOptions={{ color: "#7c3aed", weight: 3, dashArray: "6,4" }}
            />
          )}
          {drawMode === "polygon" && drawVertices.length >= 2 && (
            <Polyline
              positions={drawVertices}
              pathOptions={{ color: "#7c3aed", weight: 3, dashArray: "6,4" }}
            />
          )}
          {drawMode === "polygon" && drawVertices.length >= 3 && (
            <Polygon
              positions={drawVertices}
              pathOptions={{
                color: "#7c3aed",
                weight: 2,
                fillColor: "#7c3aed",
                fillOpacity: 0.15,
                dashArray: "6,4",
              }}
            />
          )}
        </>
      )}

      {comments.map((c) => (
        <Marker
          key={c.id}
          position={[c.lat, c.lng]}
          icon={icons.get(c.id)}
          eventHandlers={{ click: () => onSelectComment(c.id) }}
        >
          <Popup>
            <div className="min-w-[180px]">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: categoryColor(c.category) }}
                />
                <strong className="text-sm">{c.title}</strong>
              </div>
              {c.body && (
                <p className="mt-1 text-sm text-slate-600">{c.body}</p>
              )}
              {c.photos && c.photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.photos.map((p) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt="Vedlegg"
                        className="h-12 w-12 rounded border border-slate-200 object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-slate-500">
                {categoryLabel(c.category)} · {statusLabel(c.status)}
              </p>
              <p className="text-xs text-slate-400">
                {c.author_name ?? "Ukjent"} ·{" "}
                {new Date(c.created_at).toLocaleString("no-NO", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
              <AudienceNote audience={c.audience} recipients={c.recipients} />
              <JobActions
                item={c}
                lat={c.lat}
                lng={c.lng}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onAction={(action) => onJobAction("comment", action, c.id)}
              />
              {canManage(c.user_id) && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => onEditComment(c)}
                    className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Rediger
                  </button>
                  <button
                    onClick={() => onDeleteComment(c)}
                    className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    Slett
                  </button>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {showDeleted &&
        deletedComments.map((d) => (
          <Marker key={`del-${d.id}`} position={[d.lat, d.lng]} icon={deletedIcon}>
            <Popup>
              <div className="min-w-[180px]">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full opacity-60"
                    style={{ background: categoryColor(d.category) }}
                  />
                  <strong className="text-sm text-slate-600 line-through">
                    {d.title}
                  </strong>
                </div>
                {d.body && (
                  <p className="mt-1 text-sm text-slate-500">{d.body}</p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  Laget av {d.author_name ?? "Ukjent"} ·{" "}
                  {categoryLabel(d.category)}
                </p>
                <p className="text-xs font-medium text-red-500">
                  Slettet av {d.deleted_by_name ?? "Ukjent"} ·{" "}
                  {new Date(d.deleted_at).toLocaleString("no-NO", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
