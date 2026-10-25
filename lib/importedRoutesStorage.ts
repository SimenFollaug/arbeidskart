import type { ImportedRoute } from "@/lib/importRoute";

function storageKey(organizationId: string): string {
  return `arbeidskart.routes.${organizationId}`;
}

export function loadImportedRoutes(organizationId: string): ImportedRoute[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ImportedRoute[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveImportedRoutes(
  organizationId: string,
  routes: ImportedRoute[],
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(organizationId), JSON.stringify(routes));
  } catch {
    // ignore
  }
}
