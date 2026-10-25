import type { CommentStatus } from "./types";

export interface CategoryDef {
  id: string;
  label: string;
  color: string;
}

// Categories tuned for field work near regulated areas.
export const CATEGORIES: CategoryDef[] = [
  { id: "vern", label: "Vern", color: "#16a34a" },
  { id: "kulturminner", label: "Kulturminner", color: "#9333ea" },
  { id: "naturfare", label: "Naturfare", color: "#dc2626" },
  { id: "arbeid", label: "Arbeid", color: "#ea580c" },
  { id: "grunneier", label: "Grunneier", color: "#a16207" },
  { id: "info", label: "Informasjon", color: "#2563eb" },
  { id: "annet", label: "Annet", color: "#64748b" },
];

export const CATEGORY_MAP: Record<string, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
);

export function categoryColor(id: string): string {
  return CATEGORY_MAP[id]?.color ?? "#64748b";
}

export function categoryLabel(id: string): string {
  return CATEGORY_MAP[id]?.label ?? id;
}

export interface StatusDef {
  id: CommentStatus;
  label: string;
  color: string;
}

export const STATUSES: StatusDef[] = [
  { id: "apen", label: "Åpen", color: "#3b82f6" },
  { id: "viktig", label: "Viktig", color: "#dc2626" },
  { id: "lost", label: "Løst", color: "#16a34a" },
];

export const STATUS_MAP: Record<string, StatusDef> = Object.fromEntries(
  STATUSES.map((s) => [s.id, s]),
);

export function statusLabel(id: string): string {
  return STATUS_MAP[id]?.label ?? id;
}
