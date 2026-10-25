"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { WMS_LAYERS, WMS_LAYER_MAP } from "@/lib/wmsLayers";
import type {
  AppUser,
  Audience,
  Comment,
  CommentPhoto,
  DeletedComment,
  DrawMode,
  MapDrawing,
  NewComment,
} from "@/lib/types";
import { LayerControl, type LayerState } from "@/components/LayerControl";
import { Sidebar } from "@/components/Sidebar";
import { SearchBox } from "@/components/SearchBox";
import { CommentDialog } from "@/components/CommentDialog";
import { DrawDialog } from "@/components/DrawDialog";
import { AdminPanel } from "@/components/AdminPanel";
import { drawingCentroid, filterDrawingGroups, getStandaloneComments, groupDrawingsWithComments } from "@/lib/drawingComments";
import { leafletToGeoJson } from "@/lib/geojson";
import { drawingSaveErrorMessage } from "@/lib/supabase/errors";
import {
  FeatureInfoPanel,
  type FeatureInfoData,
} from "@/components/FeatureInfoPanel";
import type { QueryClick } from "@/components/MapCanvas";
import { AppCredit } from "@/components/AppCredit";
import { AppLogo } from "@/components/AppLogo";
import {
  applyProfile,
  defaultLayerState,
  loadPreferences,
  savePreferences,
  type ProfileId,
} from "@/lib/layerPreferences";
import {
  loadImportedRoutes,
  saveImportedRoutes,
} from "@/lib/importedRoutesStorage";
import {
  parseRouteFile,
  routeBounds,
  type ImportedRoute,
} from "@/lib/importRoute";

const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-200 text-sm text-slate-500">
      Laster kart…
    </div>
  ),
});

interface MapAppProps {
  initialComments: Comment[];
  currentUserId: string;
  currentUserName: string;
  currentUserIsAdmin: boolean;
  organizationId: string;
  organizationName: string;
  users: AppUser[];
}

export function MapApp({
  initialComments,
  currentUserId,
  currentUserName,
  currentUserIsAdmin,
  organizationId,
  organizationName,
  users,
}: MapAppProps) {
  const supabase = useMemo(() => createClient(), []);

  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [prefsReady, setPrefsReady] = useState(false);
  const [profileId, setProfileId] = useState<ProfileId>("standard");
  const [layers, setLayers] = useState<LayerState[]>(defaultLayerState);
  const [backgroundId, setBackgroundId] = useState("topo");
  const [importedRoutes, setImportedRoutes] = useState<ImportedRoute[]>([]);
  const [fitBounds, setFitBounds] = useState<
    [[number, number], [number, number]] | null
  >(null);
  const [fitBoundsKey, setFitBoundsKey] = useState(0);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"active" | "deleted">("active");
  const [deletedComments, setDeletedComments] = useState<DeletedComment[]>([]);
  const [showDeletedOnMap, setShowDeletedOnMap] = useState(false);
  const [showDrawings, setShowDrawings] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [drawings, setDrawings] = useState<MapDrawing[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [drawVertices, setDrawVertices] = useState<[number, number][]>([]);
  const [drawDialogOpen, setDrawDialogOpen] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Comment | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(
    null,
  );
  const [flyTo, setFlyTo] = useState<{
    lat: number;
    lng: number;
    key: number;
  } | null>(null);

  const [featureInfo, setFeatureInfo] = useState<FeatureInfoData | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [adminOpen, setAdminOpen] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [geolocateSlot, setGeolocateSlot] = useState<HTMLDivElement | null>(
    null,
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // Last lagprofil og importerte ruter fra localStorage.
  useEffect(() => {
    const prefs = loadPreferences(organizationId, currentUserId);
    setProfileId(prefs.profileId);
    setLayers(prefs.layers);
    setBackgroundId(prefs.backgroundId);
    setShowDrawings(prefs.showDrawings);
    setShowDeletedOnMap(prefs.showDeleted);
    setShowCompleted(prefs.showCompleted);
    setImportedRoutes(loadImportedRoutes(organizationId));
    setPrefsReady(true);
  }, [organizationId, currentUserId]);

  const persistPreferences = useCallback(
    (overrides: {
      profileId?: ProfileId;
      layers?: LayerState[];
      backgroundId?: string;
      showDrawings?: boolean;
      showDeleted?: boolean;
      showCompleted?: boolean;
    }) => {
      if (!prefsReady) return;
      savePreferences(organizationId, currentUserId, {
        profileId: overrides.profileId ?? profileId,
        layers: overrides.layers ?? layers,
        backgroundId: overrides.backgroundId ?? backgroundId,
        showDrawings: overrides.showDrawings ?? showDrawings,
        showDeleted: overrides.showDeleted ?? showDeletedOnMap,
        showCompleted: overrides.showCompleted ?? showCompleted,
      });
    },
    [
      prefsReady,
      organizationId,
      currentUserId,
      profileId,
      layers,
      backgroundId,
      showDrawings,
      showDeletedOnMap,
      showCompleted,
    ],
  );

  useEffect(() => {
    persistPreferences({});
  }, [
    prefsReady,
    profileId,
    layers,
    backgroundId,
    showDrawings,
    showDeletedOnMap,
    showCompleted,
    persistPreferences,
  ]);

  useEffect(() => {
    if (!prefsReady) return;
    saveImportedRoutes(organizationId, importedRoutes);
  }, [prefsReady, organizationId, importedRoutes]);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("comments_with_author")
      .select("*")
      .order("created_at", { ascending: false });
    if (!data) return;
    const list = data as Comment[];

    const ids = list.map((c) => c.id);
    if (ids.length > 0) {
      const { data: photos } = await supabase
        .from("comment_photos")
        .select("id, comment_id, storage_path")
        .in("comment_id", ids);

      if (photos) {
        const byComment = new Map<string, CommentPhoto[]>();
        for (const p of photos as {
          id: string;
          comment_id: string;
          storage_path: string;
        }[]) {
          const { data: signed } = await supabase.storage
            .from("comment-photos")
            .createSignedUrl(p.storage_path, 3600);
          const url = signed?.signedUrl ?? "";
          const arr = byComment.get(p.comment_id) ?? [];
          arr.push({ id: p.id, url, storage_path: p.storage_path });
          byComment.set(p.comment_id, arr);
        }
        for (const c of list) c.photos = byComment.get(c.id) ?? [];
      }
    }

    setComments(list);
  }, [supabase]);

  const uploadPhotos = useCallback(
    async (commentId: string, files: File[]) => {
      for (const file of files) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${organizationId}/${commentId}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("comment-photos")
          .upload(path, file, { upsert: false });
        if (upErr) continue;
        await supabase.from("comment_photos").insert({
          comment_id: commentId,
          user_id: currentUserId,
          storage_path: path,
        });
      }
    },
    [supabase, currentUserId, organizationId],
  );

  // Replace the recipient rows for a comment/drawing to match the chosen set.
  const syncRecipients = useCallback(
    async (
      kind: "comment" | "drawing",
      itemId: string,
      audience: Audience,
      recipientIds: string[],
    ) => {
      const table =
        kind === "comment" ? "comment_recipients" : "drawing_recipients";
      const idField = kind === "comment" ? "comment_id" : "drawing_id";

      await supabase.from(table).delete().eq(idField, itemId);

      if (audience === "selected" && recipientIds.length > 0) {
        await supabase.from(table).insert(
          recipientIds.map((uid) => ({
            [idField]: itemId,
            user_id: uid,
          })),
        );
      }
    },
    [supabase],
  );

  const loadDeleted = useCallback(async () => {
    const { data } = await supabase
      .from("deleted_comments_with_authors")
      .select("*")
      .order("deleted_at", { ascending: false });
    if (data) setDeletedComments(data as DeletedComment[]);
  }, [supabase]);

  const refetchDrawings = useCallback(async () => {
    const { data } = await supabase
      .from("map_drawings_with_author")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setDrawings(data as MapDrawing[]);
  }, [supabase]);

  // Live updates: any change to comments re-syncs the shared list.
  useEffect(() => {
    refetch();
    refetchDrawings();
    const channel = supabase
      .channel("comments-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        () => {
          refetch();
          loadDeleted();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "map_drawings" },
        () => {
          refetchDrawings();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refetch, loadDeleted, refetchDrawings]);

  const filteredComments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return comments.filter((c) => {
      if (!showCompleted && c.completed_at) return false;
      if (categoryFilter && c.category !== categoryFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (q) {
        const hay = `${c.title} ${c.body ?? ""} ${c.author_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [comments, search, categoryFilter, statusFilter, showCompleted]);

  const filteredDrawings = useMemo(
    () => drawings.filter((d) => showCompleted || !d.completed_at),
    [drawings, showCompleted],
  );

  const standaloneComments = useMemo(
    () => getStandaloneComments(filteredComments, filteredDrawings),
    [filteredComments, filteredDrawings],
  );

  const drawingGroups = useMemo(
    () =>
      filterDrawingGroups(
        groupDrawingsWithComments(filteredComments, filteredDrawings),
        search,
        categoryFilter,
        statusFilter,
      ),
    [filteredComments, filteredDrawings, search, categoryFilter, statusFilter],
  );

  const handleAddAt = useCallback((lat: number, lng: number) => {
    setDraft({ lat, lng });
    setEditing(null);
    setDialogOpen(true);
    setAddMode(false);
    setFeatureInfo(null);
  }, []);

  const startDraw = useCallback((mode: DrawMode) => {
    setDrawMode(mode);
    setDrawVertices([]);
    setAddMode(false);
    setFeatureInfo(null);
    setDrawDialogOpen(false);
  }, []);

  const cancelDraw = useCallback(() => {
    setDrawMode(null);
    setDrawVertices([]);
    setDrawDialogOpen(false);
  }, []);

  const handleDrawVertex = useCallback((lat: number, lng: number) => {
    setDrawVertices((prev) => [...prev, [lat, lng]]);
  }, []);

  const finishDraw = useCallback(() => {
    const min = drawMode === "polygon" ? 3 : 2;
    if (drawVertices.length < min) {
      showToast(
        drawMode === "polygon"
          ? "En sone trenger minst 3 punkter"
          : "En linje trenger minst 2 punkter",
      );
      return;
    }
    setDrawDialogOpen(true);
  }, [drawMode, drawVertices.length, showToast]);

  const handleDrawSave = useCallback(
    async (values: {
      title: string;
      body: string;
      category: string;
      audience: Audience;
      recipientIds: string[];
    }) => {
      if (!drawMode || drawVertices.length < 2) return;
      setSaving(true);
      try {
        const geojson = leafletToGeoJson(drawMode, drawVertices);
        const { data: inserted, error } = await supabase
          .from("map_drawings")
          .insert({
            user_id: currentUserId,
            title: values.title,
            body: values.body || null,
            category: values.category,
            drawing_type: drawMode,
            geojson,
            audience: values.audience,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (inserted) {
          await syncRecipients(
            "drawing",
            inserted.id as string,
            values.audience,
            values.recipientIds,
          );
        }
        showToast(
          values.audience === "selected"
            ? "Tegning lagret og delt med valgte"
            : "Tegning lagret og delt",
        );
        cancelDraw();
        await refetchDrawings();
      } catch (err) {
        console.warn("Kunne ikke lagre tegning:", err);
        showToast(drawingSaveErrorMessage(err));
      } finally {
        setSaving(false);
      }
    },
    [
      drawMode,
      drawVertices,
      supabase,
      currentUserId,
      showToast,
      cancelDraw,
      refetchDrawings,
      syncRecipients,
    ],
  );

  const handleDeleteDrawing = useCallback(
    async (drawing: MapDrawing) => {
      if (!window.confirm(`Slette «${drawing.title}»?`)) return;
      const { error } = await supabase
        .from("map_drawings")
        .delete()
        .eq("id", drawing.id);
      if (error) {
        showToast("Kunne ikke slette tegning");
        return;
      }
      showToast("Tegning slettet");
      await refetchDrawings();
    },
    [supabase, refetchDrawings, showToast],
  );

  const handleJobAction = useCallback(
    async (
      kind: "comment" | "drawing",
      action: "claim" | "release" | "complete" | "reopen",
      id: string,
    ) => {
      const fn = `${action}_${kind}`;
      const args =
        kind === "comment" ? { cid: id } : { did: id };
      const { error } = await supabase.rpc(fn, args);
      if (error) {
        showToast(error.message || "Handlingen kunne ikke fullføres");
        return;
      }
      const messages: Record<typeof action, string> = {
        claim: "Du har tatt jobben",
        release: "Jobben er frigitt",
        complete: "Jobben er kvittert ut",
        reopen: "Jobben er gjenåpnet",
      };
      showToast(messages[action]);
      await refetch();
      await refetchDrawings();
    },
    [supabase, showToast, refetch, refetchDrawings],
  );

  const handleQueryAt = useCallback(
    async (q: QueryClick) => {
      const queryable = layers.filter(
        (l) => l.enabled && WMS_LAYER_MAP[l.id]?.queryable,
      );
      if (queryable.length === 0) {
        setFeatureInfo({
          loading: false,
          lat: q.lat,
          lng: q.lng,
          results: [],
        });
        return;
      }

      setFeatureInfo({ loading: true, lat: q.lat, lng: q.lng, results: [] });

      const results = await Promise.all(
        queryable.map(async (l) => {
          const params = new URLSearchParams({
            id: l.id,
            lat: String(q.lat),
            lng: String(q.lng),
          });
          try {
            const res = await fetch(`/api/featureinfo?${params.toString()}`);
            if (!res.ok) throw new Error();
            return await res.json();
          } catch {
            return {
              layerId: l.id,
              layerName: WMS_LAYER_MAP[l.id].name,
              features: [],
            };
          }
        }),
      );

      setFeatureInfo({
        loading: false,
        lat: q.lat,
        lng: q.lng,
        results,
      });
    },
    [layers],
  );

  const handleSave = useCallback(
    async (values: NewComment) => {
      setSaving(true);
      try {
        if (editing) {
          const { error } = await supabase
            .from("comments")
            .update({
              title: values.title,
              body: values.body || null,
              category: values.category,
              status: values.status,
              lat: values.lat,
              lng: values.lng,
              audience: values.audience,
            })
            .eq("id", editing.id);
          if (error) throw error;
          await syncRecipients(
            "comment",
            editing.id,
            values.audience,
            values.recipientIds,
          );
          if (values.files && values.files.length > 0) {
            await uploadPhotos(editing.id, values.files);
          }
          showToast("Kommentar oppdatert");
        } else {
          const { data: inserted, error } = await supabase
            .from("comments")
            .insert({
              user_id: currentUserId,
              title: values.title,
              body: values.body || null,
              category: values.category,
              status: values.status,
              lat: values.lat,
              lng: values.lng,
              audience: values.audience,
            })
            .select("id")
            .single();
          if (error) throw error;
          if (inserted) {
            await syncRecipients(
              "comment",
              inserted.id as string,
              values.audience,
              values.recipientIds,
            );
            if (values.files && values.files.length > 0) {
              await uploadPhotos(inserted.id as string, values.files);
            }
          }
          showToast(
            values.audience === "selected"
              ? "Kommentar lagt til og delt med valgte"
              : "Kommentar lagt til og delt",
          );
        }
        setDialogOpen(false);
        setEditing(null);
        setDraft(null);
        await refetch();
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Kunne ikke lagre kommentar",
        );
      } finally {
        setSaving(false);
      }
    },
    [
      editing,
      supabase,
      currentUserId,
      refetch,
      uploadPhotos,
      showToast,
      syncRecipients,
    ],
  );

  const handleDelete = useCallback(
    async (comment: Comment) => {
      if (!window.confirm(`Slette «${comment.title}»?`)) return;
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", comment.id);
      if (error) {
        showToast("Kunne ikke slette");
        return;
      }
      showToast("Kommentar slettet");
      await refetch();
      await loadDeleted();
    },
    [supabase, refetch, loadDeleted, showToast],
  );

  const handleTabChange = useCallback(
    (tab: "active" | "deleted") => {
      setSidebarTab(tab);
      if (tab === "deleted") loadDeleted();
    },
    [loadDeleted],
  );

  const handleLocate = useCallback((lat: number, lng: number) => {
    setFlyTo({ lat, lng, key: Date.now() });
    setSidebarOpen(false);
  }, []);

  const handleToggleDeletedOnMap = useCallback(() => {
    setShowDeletedOnMap((prev) => {
      const next = !prev;
      if (next) loadDeleted();
      return next;
    });
  }, [loadDeleted]);

  const handleEdit = useCallback((comment: Comment) => {
    setEditing(comment);
    setDraft(null);
    setDialogOpen(true);
  }, []);

  const handleSelect = useCallback((comment: Comment) => {
    setSelectedId(comment.id);
    setSelectedDrawingId(null);
    setFlyTo({ lat: comment.lat, lng: comment.lng, key: Date.now() });
    setSidebarOpen(false);
  }, []);

  const handleSelectDrawing = useCallback((drawing: MapDrawing) => {
    const { lat, lng } = drawingCentroid(drawing);
    setSelectedDrawingId(drawing.id);
    setSelectedId(null);
    setFlyTo({ lat, lng, key: Date.now() });
    setSidebarOpen(false);
  }, []);

  const toggleLayer = useCallback((id: string) => {
    setProfileId("custom");
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l)),
    );
  }, []);

  const setOpacity = useCallback((id: string, opacity: number) => {
    setProfileId("custom");
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, opacity } : l)),
    );
  }, []);

  const handleProfileChange = useCallback((next: ProfileId) => {
    if (next === "custom") {
      setProfileId("custom");
      return;
    }
    setProfileId(next);
    setLayers(applyProfile(next));
  }, []);

  const handleImportRoute = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = parseRouteFile(text, file.name);
        setImportedRoutes((prev) => [...prev, ...parsed]);
        const bounds = routeBounds(parsed);
        if (bounds) {
          setFitBounds(bounds);
          setFitBoundsKey(Date.now());
        }
        showToast(
          parsed.length === 1
            ? `Importerte «${parsed[0].name}»`
            : `Importerte ${parsed.length} ruter`,
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Kunne ikke importere fil");
      }
    },
    [showToast],
  );

  const handleToggleImportedRoute = useCallback((id: string) => {
    setImportedRoutes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r)),
    );
  }, []);

  const handleRemoveImportedRoute = useCallback((id: string) => {
    setImportedRoutes((prev) => prev.filter((r) => r.id !== id));
    showToast("Importert rute fjernet");
  }, [showToast]);

  const handleClearImportedRoutes = useCallback(() => {
    if (!window.confirm("Fjerne alle importerte ruter?")) return;
    setImportedRoutes([]);
    showToast("Alle importerte ruter fjernet");
  }, [showToast]);

  const enabledLayers = useMemo(
    () =>
      layers
        .filter((l) => l.enabled)
        .map((l) => ({ id: l.id, opacity: l.opacity })),
    [layers],
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Vis kommentarer"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <AppLogo className="md:hidden" size={34} />
          <span className="hidden truncate text-lg font-bold text-slate-900 md:inline">
            Arbeidskart
          </span>
          <span className="hidden text-xs text-slate-500 lg:inline">
            {organizationName}
          </span>
          <span className="hidden text-xs text-slate-400 xl:inline">
            · Verneområder · kulturminner · eiendom · strømnett
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
          {!drawMode && (
            <>
              <button
                onClick={() => startDraw("line")}
                className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:px-3"
              >
                <span className="sm:hidden">Linje</span>
                <span className="hidden sm:inline">Tegn linje</span>
              </button>
              <button
                onClick={() => startDraw("polygon")}
                className="rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-2 text-sm font-medium text-violet-800 hover:bg-violet-100 sm:px-3"
              >
                <span className="sm:hidden">Sone</span>
                <span className="hidden sm:inline">Tegn sone</span>
              </button>
            </>
          )}
          {!drawMode && (
            <button
              onClick={() => {
                setAddMode((a) => !a);
                setFeatureInfo(null);
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                addMode
                  ? "bg-amber-500 text-white"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              <span className="sm:hidden">{addMode ? "Klikk…" : "+ Ny"}</span>
              <span className="hidden sm:inline">
                {addMode ? "Klikk i kartet…" : "+ Ny kommentar"}
              </span>
            </button>
          )}
          {currentUserIsAdmin && (
            <button
              onClick={() => setAdminOpen(true)}
              className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:px-3"
            >
              Admin
            </button>
          )}
          <span className="hidden text-sm text-slate-600 lg:inline">
            {currentUserName}
          </span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Logg ut
            </button>
          </form>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar
          comments={standaloneComments}
          drawingGroups={drawingGroups}
          selectedId={selectedId}
          selectedDrawingId={selectedDrawingId}
          search={search}
          categoryFilter={categoryFilter}
          statusFilter={statusFilter}
          onSearch={setSearch}
          onCategoryFilter={setCategoryFilter}
          onStatusFilter={setStatusFilter}
          onSelect={handleSelect}
          onSelectDrawing={handleSelectDrawing}
          currentUserId={currentUserId}
          isAdmin={currentUserIsAdmin}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDeleteDrawing={handleDeleteDrawing}
          onJobAction={handleJobAction}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          tab={sidebarTab}
          onTabChange={handleTabChange}
          deletedComments={deletedComments}
          onLocate={handleLocate}
        />

        <main className="relative min-w-0 flex-1">
          {addMode && (
            <div className="absolute left-1/2 top-16 z-[1000] -translate-x-1/2 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-white shadow-lg">
              Klikk i kartet for å plassere kommentaren
            </div>
          )}

          {drawMode && (
            <>
              <div className="absolute left-1/2 top-16 z-[1000] -translate-x-1/2 rounded-full bg-violet-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg">
                Klikk for å legge punkter ({drawVertices.length} lagt)
              </div>
              <div className="absolute bottom-24 left-1/2 z-[1000] flex -translate-x-1/2 gap-2">
                <button
                  onClick={finishDraw}
                  className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-violet-700"
                >
                  Ferdig
                </button>
                <button
                  onClick={cancelDraw}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-lg hover:bg-slate-50"
                >
                  Avbryt
                </button>
              </div>
            </>
          )}

          <div className="pointer-events-none absolute right-3 top-3 z-[1100] w-[calc(100vw-1.5rem)] max-w-72">
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <LayerControl
                layers={layers}
                backgroundId={backgroundId}
                profileId={profileId}
                onProfileChange={handleProfileChange}
                onToggle={toggleLayer}
                onOpacity={setOpacity}
                onBackground={(id) => {
                  setProfileId("custom");
                  setBackgroundId(id);
                }}
                showDeleted={showDeletedOnMap}
                onToggleDeleted={handleToggleDeletedOnMap}
                showDrawings={showDrawings}
                onToggleDrawings={() => {
                  setProfileId("custom");
                  setShowDrawings((v) => !v);
                }}
                showCompleted={showCompleted}
                onToggleCompleted={() => {
                  setProfileId("custom");
                  setShowCompleted((v) => !v);
                }}
                importedRoutes={importedRoutes}
                onImportRoute={handleImportRoute}
                onToggleImportedRoute={handleToggleImportedRoute}
                onRemoveImportedRoute={handleRemoveImportedRoute}
                onClearImportedRoutes={handleClearImportedRoutes}
              />
              <div
                ref={setGeolocateSlot}
                className="flex w-full flex-col items-end gap-2"
              />
            </div>
          </div>

          <MapCanvas
            backgroundId={backgroundId}
            enabledLayers={enabledLayers}
            comments={filteredComments}
            deletedComments={deletedComments}
            showDeleted={showDeletedOnMap}
            drawings={filteredDrawings}
            showDrawings={showDrawings}
            importedRoutes={importedRoutes}
            fitBounds={fitBounds}
            fitBoundsKey={fitBoundsKey}
            addMode={addMode}
            drawMode={drawMode}
            drawVertices={drawVertices}
            selectedId={selectedId}
            selectedDrawingId={selectedDrawingId}
            flyTo={flyTo}
            onAddAt={handleAddAt}
            onDrawVertex={handleDrawVertex}
            onQueryAt={handleQueryAt}
            onSelectComment={setSelectedId}
            onEditComment={handleEdit}
            onDeleteComment={handleDelete}
            onDeleteDrawing={handleDeleteDrawing}
            onJobAction={handleJobAction}
            currentUserId={currentUserId}
            isAdmin={currentUserIsAdmin}
            geolocateSlot={geolocateSlot}
          />

          <FeatureInfoPanel
            data={featureInfo}
            onClose={() => setFeatureInfo(null)}
            onAddHere={(lat, lng) => handleAddAt(lat, lng)}
          />

          <div className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-3 z-[1100] w-[min(calc(100vw-1.5rem),18rem)] md:absolute md:bottom-auto md:left-14 md:right-auto md:top-3 md:w-72 md:max-w-[calc(100vw-7rem)]">
            <div className="pointer-events-auto">
              <SearchBox onSelect={handleLocate} />
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded-lg border border-slate-200/80 bg-white/95 px-2.5 py-1.5 shadow-sm backdrop-blur">
            <AppCredit />
          </div>
        </main>
      </div>

      <CommentDialog
        open={dialogOpen}
        editing={editing}
        location={draft}
        saving={saving}
        users={users}
        currentUserId={currentUserId}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
          setDraft(null);
        }}
        onSave={handleSave}
      />

      {drawMode && (
        <DrawDialog
          open={drawDialogOpen}
          drawingType={drawMode}
          vertices={drawVertices}
          saving={saving}
          users={users}
          currentUserId={currentUserId}
          onClose={() => setDrawDialogOpen(false)}
          onSave={handleDrawSave}
        />
      )}

      <AdminPanel
        open={adminOpen}
        users={users}
        currentUserId={currentUserId}
        supabase={supabase}
        onClose={() => setAdminOpen(false)}
      />

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-[3000] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
