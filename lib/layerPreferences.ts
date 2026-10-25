import { WMS_LAYERS } from "@/lib/wmsLayers";
import type { LayerState } from "@/components/LayerControl";

export type ProfileId = "standard" | "felt" | "skog" | "custom";

export interface MapPreferences {
  profileId: ProfileId;
  layers: LayerState[];
  backgroundId: string;
  showDrawings: boolean;
  showDeleted: boolean;
  showCompleted: boolean;
}

export const PROFILE_OPTIONS: { id: ProfileId; name: string }[] = [
  { id: "standard", name: "Standard" },
  { id: "felt", name: "Felt" },
  { id: "skog", name: "Skogrydding" },
  { id: "custom", name: "Egendefinert" },
];

/** Hvilke WMS-lag som skal være på i hver forhåndsprofil. */
const PROFILE_ENABLED: Record<Exclude<ProfileId, "custom">, string[]> = {
  standard: WMS_LAYERS.filter((l) => l.defaultEnabled).map((l) => l.id),
  felt: [
    "verneomrader",
    "kulturminner",
    "kvikkleire",
    "skredfaresoner",
    "flom_erosjon",
    "eiendom",
    "stromnett_overforing",
    "stromnett_hsp",
  ],
  skog: [
    "verneomrader",
    "utvalgte_naturtyper",
    "fredete_arter",
    "hogstklasser",
    "mis",
    "kulturminner",
    "eiendom",
    "stromnett_hsp",
    "stromnett_anlegg",
  ],
};

export function defaultLayerState(): LayerState[] {
  return WMS_LAYERS.map((l) => ({
    id: l.id,
    enabled: l.defaultEnabled,
    opacity: 0.85,
  }));
}

export function defaultPreferences(): MapPreferences {
  return {
    profileId: "standard",
    layers: defaultLayerState(),
    backgroundId: "topo",
    showDrawings: true,
    showDeleted: false,
    showCompleted: false,
  };
}

export function applyProfile(profileId: Exclude<ProfileId, "custom">): LayerState[] {
  const enabled = new Set(PROFILE_ENABLED[profileId]);
  return defaultLayerState().map((l) => ({
    ...l,
    enabled: enabled.has(l.id),
  }));
}

/** Slår sammen lagret state med gjeldende WMS-konfig (nye lag får default). */
export function mergeLayerState(saved: LayerState[] | undefined): LayerState[] {
  const savedMap = new Map((saved ?? []).map((l) => [l.id, l]));
  return WMS_LAYERS.map((cfg) => {
    const hit = savedMap.get(cfg.id);
    return (
      hit ?? {
        id: cfg.id,
        enabled: cfg.defaultEnabled,
        opacity: 0.85,
      }
    );
  });
}

function storageKey(organizationId: string, userId: string): string {
  return `arbeidskart.prefs.${organizationId}.${userId}`;
}

export function loadPreferences(
  organizationId: string,
  userId: string,
): MapPreferences {
  if (typeof window === "undefined") return defaultPreferences();
  try {
    const raw = localStorage.getItem(storageKey(organizationId, userId));
    if (!raw) return defaultPreferences();
    const parsed = JSON.parse(raw) as Partial<MapPreferences>;
    const defaults = defaultPreferences();
    return {
      profileId: parsed.profileId ?? defaults.profileId,
      layers: mergeLayerState(parsed.layers),
      backgroundId: parsed.backgroundId ?? defaults.backgroundId,
      showDrawings: parsed.showDrawings ?? defaults.showDrawings,
      showDeleted: parsed.showDeleted ?? defaults.showDeleted,
      showCompleted: parsed.showCompleted ?? defaults.showCompleted,
    };
  } catch {
    return defaultPreferences();
  }
}

export function savePreferences(
  organizationId: string,
  userId: string,
  prefs: MapPreferences,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(organizationId, userId), JSON.stringify(prefs));
  } catch {
    // localStorage full or unavailable – ignore
  }
}
