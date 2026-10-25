import { KOMMUNER, type KommuneEntry } from "./kommuner";

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
}

function kommuneNames(k: KommuneEntry): string[] {
  return [k.kommunenavn, k.kommunenavnNorsk].filter(Boolean) as string[];
}

const byName = new Map<string, KommuneEntry>();
const byNumber = new Map<string, KommuneEntry>();

for (const kommune of KOMMUNER) {
  byNumber.set(kommune.kommunenummer, kommune);
  for (const name of kommuneNames(kommune)) {
    byName.set(normalizeName(name), kommune);
  }
}

export function lookupKommune(ref: string): {
  nummer: string;
  navn: string;
} | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  if (/^\d{3,4}$/.test(trimmed)) {
    const nummer = trimmed.padStart(4, "0");
    const hit = byNumber.get(nummer);
    return {
      nummer,
      navn: hit?.kommunenavn ?? nummer,
    };
  }

  const exact = byName.get(normalizeName(trimmed));
  if (exact) {
    return { nummer: exact.kommunenummer, navn: exact.kommunenavn };
  }

  const needle = normalizeName(trimmed);
  for (const [name, kommune] of byName.entries()) {
    if (name.startsWith(needle)) {
      return { nummer: kommune.kommunenummer, navn: kommune.kommunenavn };
    }
  }

  return null;
}

export { normalizeName };
