"use client";

import { CATEGORIES, STATUSES, categoryColor, categoryLabel, statusLabel } from "@/lib/categories";
import type { DrawingWithComments } from "@/lib/drawingComments";
import { geojsonCenter } from "@/lib/geojson";
import type { Comment, DeletedComment, MapDrawing } from "@/lib/types";
import { AppCredit } from "@/components/AppCredit";
import { JobActions, type JobAction } from "@/components/JobActions";

interface SidebarProps {
  comments: Comment[];
  drawingGroups: DrawingWithComments[];
  selectedId: string | null;
  selectedDrawingId: string | null;
  search: string;
  categoryFilter: string;
  statusFilter: string;
  onSearch: (v: string) => void;
  onCategoryFilter: (v: string) => void;
  onStatusFilter: (v: string) => void;
  onSelect: (c: Comment) => void;
  onSelectDrawing: (d: MapDrawing) => void;
  currentUserId: string;
  isAdmin: boolean;
  onEdit: (c: Comment) => void;
  onDelete: (c: Comment) => void;
  onDeleteDrawing: (d: MapDrawing) => void;
  onJobAction: (
    kind: "comment" | "drawing",
    action: JobAction,
    id: string,
  ) => void;
  open: boolean;
  onClose: () => void;
  tab: "active" | "deleted";
  onTabChange: (tab: "active" | "deleted") => void;
  deletedComments: DeletedComment[];
  onLocate: (lat: number, lng: number) => void;
}

/** "Delt med"-etikett for elementer som er begrenset til bestemte brukere. */
function AudienceTag({
  audience,
  recipients,
}: {
  audience: Comment["audience"];
  recipients: Comment["recipients"];
}) {
  if (audience !== "selected") return null;
  const names = recipients.map((r) => r.name ?? "Ukjent").join(", ");
  return (
    <p className="mt-0.5 truncate text-[11px] text-amber-600">
      Delt med: {names || "kun deg"}
    </p>
  );
}

function CommentRow({
  comment,
  selected,
  currentUserId,
  isAdmin,
  onSelect,
  onEdit,
  onDelete,
  onJobAction,
  nested = false,
}: {
  comment: Comment;
  selected: boolean;
  currentUserId: string;
  isAdmin: boolean;
  onSelect: (c: Comment) => void;
  onEdit: (c: Comment) => void;
  onDelete: (c: Comment) => void;
  onJobAction: (
    kind: "comment" | "drawing",
    action: JobAction,
    id: string,
  ) => void;
  nested?: boolean;
}) {
  const canManage = comment.user_id === currentUserId || isAdmin;
  return (
    <li
      className={`cursor-pointer px-3 py-3 transition hover:bg-slate-50 ${
        selected ? "bg-blue-50" : ""
      } ${nested ? "pl-6" : ""}`}
      onClick={() => onSelect(comment)}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 inline-block h-3 w-3 flex-shrink-0 rounded-full"
          style={{ background: categoryColor(comment.category) }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-slate-800">
              {comment.title}
            </p>
            {comment.status === "viktig" && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                VIKTIG
              </span>
            )}
          </div>
          {comment.body && (
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
              {comment.body}
            </p>
          )}
          {comment.photos && comment.photos.length > 0 && (
            <div className="mt-1 flex gap-1">
              {comment.photos.slice(0, 4).map((p) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={p.id}
                  src={p.url}
                  alt="Vedlegg"
                  className="h-10 w-10 rounded border border-slate-200 object-cover"
                />
              ))}
            </div>
          )}
          <p className="mt-1 text-[11px] text-slate-400">
            {comment.author_name ?? "Ukjent"} · {statusLabel(comment.status)} ·{" "}
            {new Date(comment.created_at).toLocaleDateString("no-NO", {
              day: "numeric",
              month: "short",
            })}
          </p>
          <AudienceTag
            audience={comment.audience}
            recipients={comment.recipients}
          />
          <JobActions
            item={comment}
            lat={comment.lat}
            lng={comment.lng}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onAction={(action) => onJobAction("comment", action, comment.id)}
          />
          {canManage && (
            <div className="mt-1.5 flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(comment);
                }}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
              >
                Rediger
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(comment);
                }}
                className="text-[11px] font-medium text-red-500 hover:text-red-700"
              >
                Slett
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function Sidebar({
  comments,
  drawingGroups,
  selectedId,
  selectedDrawingId,
  search,
  categoryFilter,
  statusFilter,
  onSearch,
  onCategoryFilter,
  onStatusFilter,
  onSelect,
  onSelectDrawing,
  currentUserId,
  isAdmin,
  onEdit,
  onDelete,
  onDeleteDrawing,
  onJobAction,
  open,
  onClose,
  tab,
  onTabChange,
  deletedComments,
  onLocate,
}: SidebarProps) {
  const drawingCount = drawingGroups.length;
  const nestedCommentCount = drawingGroups.reduce(
    (n, g) => n + g.comments.length,
    0,
  );

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[1400] bg-slate-900/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[1500] flex w-80 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 md:static md:z-auto md:max-w-none md:flex-shrink-0 md:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 md:hidden">
          <span className="text-sm font-semibold text-slate-800">
            Kommentarer
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Lukk"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-100 px-3 pt-2 text-sm font-medium">
          <button
            onClick={() => onTabChange("active")}
            className={`-mb-px border-b-2 px-3 py-2 transition ${
              tab === "active"
                ? "border-blue-600 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Aktive
          </button>
          {isAdmin && (
            <button
              onClick={() => onTabChange("deleted")}
              className={`-mb-px border-b-2 px-3 py-2 transition ${
                tab === "deleted"
                  ? "border-blue-600 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Slettede
            </button>
          )}
        </div>

        {tab === "active" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-slate-100 p-3">
              <input
                type="search"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Søk i kommentarer og tegninger…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => onCategoryFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Alle kategorier</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => onStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Alle statuser</option>
                  {STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-400">
              <span>
                {comments.length} kommentar{comments.length === 1 ? "" : "er"}
                {drawingCount > 0 &&
                  ` · ${drawingCount} tegning${drawingCount === 1 ? "" : "er"}`}
                {nestedCommentCount > 0 &&
                  ` (${nestedCommentCount} på tegning)`}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {comments.length === 0 && drawingGroups.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  Ingen kommentarer eller tegninger ennå. Bruk «Ny kommentar»
                  eller tegneverktøyene i kartet.
                </p>
              ) : (
                <>
                  {comments.length > 0 && (
                    <ul className="divide-y divide-slate-100">
                      {comments.map((c) => (
                        <CommentRow
                          key={c.id}
                          comment={c}
                          selected={c.id === selectedId}
                          currentUserId={currentUserId}
                          isAdmin={isAdmin}
                          onSelect={onSelect}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onJobAction={onJobAction}
                        />
                      ))}
                    </ul>
                  )}

                  {drawingGroups.length > 0 && (
                    <div className="border-t border-slate-200">
                      <p className="sticky top-0 z-10 bg-slate-50 px-3 py-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                        Tegninger
                      </p>
                      <ul className="divide-y divide-slate-100">
                        {drawingGroups.map(({ drawing, comments: nested }) => (
                          <li key={drawing.id}>
                            <div
                              className={`cursor-pointer px-3 py-3 transition hover:bg-slate-50 ${
                                drawing.id === selectedDrawingId
                                  ? "bg-violet-50"
                                  : ""
                              }`}
                              onClick={() => onSelectDrawing(drawing)}
                            >
                              <div className="flex items-start gap-2">
                                <span className="mt-0.5 flex-shrink-0 text-sm">
                                  {drawing.drawing_type === "polygon"
                                    ? "⬡"
                                    : "╱"}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                                      style={{
                                        background: categoryColor(drawing.category),
                                      }}
                                    />
                                    <p className="truncate text-sm font-medium text-slate-800">
                                      {drawing.title}
                                    </p>
                                  </div>
                                  {drawing.body && (
                                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                                      {drawing.body}
                                    </p>
                                  )}
                                  <p className="mt-1 text-[11px] text-slate-400">
                                    {categoryLabel(drawing.category)} ·{" "}
                                    {drawing.drawing_type === "polygon"
                                      ? "Sone"
                                      : "Linje"}
                                    {nested.length > 0 &&
                                      ` · ${nested.length} kommentar${nested.length === 1 ? "" : "er"}`}
                                  </p>
                                  <AudienceTag
                                    audience={drawing.audience}
                                    recipients={drawing.recipients}
                                  />
                                  <JobActions
                                    item={drawing}
                                    lat={geojsonCenter(drawing.geojson)?.lat}
                                    lng={geojsonCenter(drawing.geojson)?.lng}
                                    currentUserId={currentUserId}
                                    isAdmin={isAdmin}
                                    onAction={(action) =>
                                      onJobAction("drawing", action, drawing.id)
                                    }
                                  />
                                  {(drawing.user_id === currentUserId ||
                                    isAdmin) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteDrawing(drawing);
                                      }}
                                      className="mt-1.5 text-[11px] font-medium text-red-500 hover:text-red-700"
                                    >
                                      Slett tegning
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            {nested.length > 0 && (
                              <ul className="border-t border-slate-100 bg-slate-50/60">
                                {nested.map((c) => (
                                  <CommentRow
                                    key={c.id}
                                    comment={c}
                                    selected={c.id === selectedId}
                                    currentUserId={currentUserId}
                                    isAdmin={isAdmin}
                                    onSelect={onSelect}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onJobAction={onJobAction}
                                    nested
                                  />
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {tab === "deleted" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-400">
              <span>{deletedComments.length} slettet</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {deletedComments.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  Ingen slettede kommentarer. Når noen sletter en kommentar,
                  arkiveres den her med hvem som slettet den.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {deletedComments.map((d) => (
                    <li key={d.id} className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-1 inline-block h-3 w-3 flex-shrink-0 rounded-full opacity-60"
                          style={{ background: categoryColor(d.category) }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-600 line-through">
                            {d.title}
                          </p>
                          {d.body && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                              {d.body}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-slate-400">
                            Laget av {d.author_name ?? "Ukjent"} ·{" "}
                            {statusLabel(d.status)}
                          </p>
                          <p className="text-[11px] font-medium text-red-500">
                            Slettet av {d.deleted_by_name ?? "Ukjent"} ·{" "}
                            {new Date(d.deleted_at).toLocaleString("no-NO", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <button
                            onClick={() => onLocate(d.lat, d.lng)}
                            className="mt-1 text-[11px] font-medium text-blue-600 hover:underline"
                          >
                            Vis sted i kart
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        <div className="flex-shrink-0 border-t border-slate-100 bg-white px-3 py-2.5">
          <AppCredit />
        </div>
      </aside>
    </>
  );
}
