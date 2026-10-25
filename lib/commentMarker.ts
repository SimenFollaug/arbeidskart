import { categoryColor } from "@/lib/categories";

/** Kategorier som vises med eget ikon i stedet for ren farge-pin. */
export type CommentMarkerIcon = "tree" | "info-i" | "person";

const CATEGORY_MARKER_ICON: Record<string, CommentMarkerIcon> = {
  arbeid: "tree",
  info: "info-i",
  grunneier: "person",
};

export function commentMarkerIcon(
  category: string,
): CommentMarkerIcon | null {
  return CATEGORY_MARKER_ICON[category] ?? null;
}

const TREE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M12 2c-1.5 2.2-3.8 3.5-3.8 6.3 0 1.4.8 2.5 2 3.1-.9.6-1.5 1.6-1.5 2.8 0 1.9 1.6 3.4 3.5 3.4h.8c1.9 0 3.5-1.5 3.5-3.4 0-1.2-.6-2.2-1.5-2.8 1.2-.6 2-1.7 2-3.1 0-2.8-2.3-4.1-3.8-6.3zm-1 17.5V22h2v-2.5c1.7-.3 3-1.8 3-3.6h-8c0 1.8 1.3 3.3 3 3.6z"/></svg>`;

const PERSON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z"/></svg>`;

function glyphHtml(icon: CommentMarkerIcon): string {
  switch (icon) {
    case "tree":
      return `<span class="arb-marker__glyph">${TREE_SVG}</span>`;
    case "person":
      return `<span class="arb-marker__glyph">${PERSON_SVG}</span>`;
    case "info-i":
      return `<span class="arb-marker__glyph arb-marker__glyph--info">I</span>`;
  }
}

/** HTML for Leaflet DivIcon – kategori-spesifikke ikoner eller standard pin. */
export function buildCommentMarkerHtml(
  category: string,
  selected: boolean,
  important: boolean,
): string {
  const color = categoryColor(category);
  const icon = commentMarkerIcon(category);
  const classes = [
    "arb-marker",
    icon ? "arb-marker--icon" : "",
    important ? "is-important" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const outline = selected
    ? "outline:3px solid #1d4ed8;outline-offset:1px;"
    : "";

  if (icon) {
    const bg =
      icon === "info-i"
        ? "#ffffff"
        : color;
    return `<div class="${classes}${icon === "info-i" ? " arb-marker--info" : ""}" style="background:${bg};${outline}">${glyphHtml(icon)}</div>`;
  }

  return `<div class="${classes}" style="background:${color};${outline}"></div>`;
}
