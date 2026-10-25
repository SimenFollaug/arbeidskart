/** Parse WMS GetFeatureInfo responses (HTML, Esri XML, MapServer GML, GeoJSON). */

const SKIP_FIELDS = new Set([
  "shape",
  "globalid",
  "objectid",
  "shape.starea()",
  "shape.stlength()",
  "shaPE.STArea()",
  "SHAPE.STLength()",
]);

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parseXmlAttributes(attrText: string): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  const attrRe = /([\w.]+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(attrText)) !== null) {
    const key = m[1];
    const val = m[2].trim();
    if (val && val.toLowerCase() !== "null") attrs[key] = val;
  }
  return attrs;
}

function parseEsriFieldsXml(text: string): Record<string, unknown>[] {
  const features: Record<string, unknown>[] = [];
  const re = /<FIELDS\s+([^>]+?)\s*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const attrs = parseXmlAttributes(m[1]);
    if (Object.keys(attrs).length > 0) features.push(attrs);
  }
  return features;
}

function parseGmlFeatures(text: string): Record<string, unknown>[] {
  const features: Record<string, unknown>[] = [];
  const featureRe = /<(\w+)_feature>([\s\S]*?)<\/\1_feature>/gi;
  let m: RegExpExecArray | null;
  while ((m = featureRe.exec(text)) !== null) {
    const body = m[2];
    const obj: Record<string, unknown> = {};
    const tagRe = /<([\w]+)>([^<]*)<\/\1>/g;
    let t: RegExpExecArray | null;
    while ((t = tagRe.exec(body)) !== null) {
      const val = t[2].trim();
      if (val) obj[t[1]] = val;
    }
    if (Object.keys(obj).length > 0) features.push(obj);
  }
  return features;
}

function parseHtmlKeyValueSections(text: string): Record<string, unknown>[] {
  const features: Record<string, unknown>[] = [];
  const normalized = text.replace(/\r\n/g, "\n");
  const chunks = normalized.split(/<h3[^>]*>/i).slice(1);

  for (const chunk of chunks) {
    const titleEnd = chunk.search(/<\/h\d>/i);
    const title =
      titleEnd >= 0 ? stripTags(chunk.slice(0, titleEnd)) : undefined;
    const body = titleEnd >= 0 ? chunk.slice(titleEnd) : chunk;
    const obj: Record<string, unknown> = {};
    if (title) obj._title = title;

    const rowRe =
      /<tr[^>]*>\s*<td[^>]*>\s*<b>\s*([^<]+?)\s*<\/b>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
    let row: RegExpExecArray | null;
    while ((row = rowRe.exec(body)) !== null) {
      const key = stripTags(row[1]);
      const val = stripTags(row[2]);
      if (key && val) obj[key] = val;
    }

    if (Object.keys(obj).length > (title ? 1 : 0)) features.push(obj);
  }

  return features;
}

function parseHtmlTable(text: string): Record<string, unknown>[] {
  const rows: { cells: string[]; isHeader: boolean }[] = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(text)) !== null) {
    const cells: string[] = [];
    const cellPattern = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length > 0) {
      rows.push({ cells, isHeader: /<th/i.test(rowMatch[1]) });
    }
  }

  let headers: string[] | null = null;
  const features: Record<string, unknown>[] = [];

  for (const row of rows) {
    if (row.isHeader) {
      if (!headers && row.cells.every((c) => !/^\d+$/.test(c) && c.length < 40)) {
        headers = row.cells;
      }
      continue;
    }
    if (!headers) continue;

    const obj: Record<string, unknown> = {};
    row.cells.forEach((c, i) => {
      if (c) obj[headers![i] ?? `felt_${i}`] = c;
    });
    if (Object.values(obj).some((v) => String(v).trim() !== "")) {
      features.push(obj);
    }
  }

  return features;
}

function parseGeoJson(text: string): Record<string, unknown>[] {
  try {
    const json = JSON.parse(text) as {
      features?: { properties?: Record<string, unknown> }[];
    };
    if (Array.isArray(json.features)) {
      return json.features
        .map((f) => f.properties ?? {})
        .filter((p) => Object.keys(p).length > 0);
    }
  } catch {
    // Not JSON.
  }
  return [];
}

export function parseFeatureInfoResponse(text: string): Record<string, unknown>[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.includes("<FIELDS")) {
    const esri = parseEsriFieldsXml(trimmed);
    if (esri.length > 0) return esri;
  }

  if (trimmed.includes("msGMLOutput") || trimmed.includes("_feature>")) {
    const gml = parseGmlFeatures(trimmed);
    if (gml.length > 0) return gml;
  }

  const geo = parseGeoJson(trimmed);
  if (geo.length > 0) return geo;

  if (/<html/i.test(trimmed) || /<table/i.test(trimmed)) {
    const kv = parseHtmlKeyValueSections(trimmed);
    if (kv.length > 0) return kv;
    const table = parseHtmlTable(trimmed);
    if (table.length > 0) return table;
  }

  return [];
}

const PREFERRED_FIELDS = [
  "_title",
  "navn",
  "offisieltNavn",
  "lokalitetsnavn",
  "UtvalgtNaturtype",
  "verneform",
  "verneplan",
  "vernedato",
  "kommune",
  "kommunenavn",
  "matrikkelnummertekst",
  "matrikkelnummer",
  "objekttype",
  "lokalitetsart",
  "lokalitetskategori",
  "kategori",
  "kulturminne",
  "norsk_navn",
  "vitenskapelig_navn",
  "artsgruppe",
  "faregrad",
  "risiko",
  "skredtype",
  "skredsannsynlighet",
  "faktaark",
  "linkAskeladden",
  "linkKulturminnesøk",
  "informasjon",
  "forvaltningsmyndighet",
  "vernetype",
  "anleggsnavn",
  "spenning",
];

const FIELD_LABELS: Record<string, string> = {
  _title: "Navn",
  navn: "Navn",
  offisieltNavn: "Offisielt navn",
  verneform: "Verneform",
  verneformAggregert: "Verneform",
  verneplan: "Verneplan",
  vernedato: "Vernedato",
  verneforskrift: "Verneforskrift",
  kommune: "Kommune",
  kommunenavn: "Kommune",
  forvaltningsmyndighet: "Forvalter",
  iucn: "IUCN-kategori",
  UtvalgtNaturtype: "Naturtype",
  UtvalgtNaturtypeKode: "Kode",
  Kommune: "Kommune",
  Faktaark: "Faktaark",
  matrikkelnummertekst: "Gnr/bnr",
  objekttype: "Type",
  lokalitetsart: "Lokalitetsart",
  lokalitetskategori: "Kategori",
  kulturminneId: "Kulturminne-ID",
  norsk_navn: "Art",
  vitenskapelig_navn: "Vitenskapelig navn",
  artsgruppe: "Artsgruppe",
  faregrad: "Faregrad",
  risiko: "Risiko",
  skredtype: "Skredtype",
  skredsannsynlighet: "Sannsynlighet",
  vassomr: "Vassdrag",
  opphav: "Opphav",
  faktaark: "Faktaark",
  linkAskeladden: "Askeladden",
  linkKulturminnesøk: "Kulturminnesøk",
  informasjon: "Informasjon",
  vernetype: "Vernetype",
  lagretberegnetareal: "Areal (m²)",
};

export function featureTitle(props: Record<string, unknown>): string | null {
  for (const key of [
    "_title",
    "navn",
    "offisieltNavn",
    "lokalitetsnavn",
    "UtvalgtNaturtype",
    "matrikkelnummertekst",
    "norsk_navn",
  ]) {
    const v = props[key];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return null;
}

export function pickDisplayFields(
  props: Record<string, unknown>,
): [string, string, unknown][] {
  const entries = Object.entries(props).filter(([k, v]) => {
    if (SKIP_FIELDS.has(k.toLowerCase())) return false;
    if (k.startsWith("_") && k !== "_title") return false;
    return v != null && String(v).trim() !== "";
  });

  const preferred = entries.filter(([k]) =>
    PREFERRED_FIELDS.some(
      (p) => k.toLowerCase() === p.toLowerCase() || k.includes(p),
    ),
  );
  const chosen =
    preferred.length > 0
      ? preferred
      : entries.filter(([k]) => !k.toLowerCase().includes("id"));

  const seen = new Set<string>();
  const out: [string, string, unknown][] = [];
  for (const [k, v] of chosen) {
    const label = FIELD_LABELS[k] ?? k;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push([k, label, v]);
    if (out.length >= 10) break;
  }
  return out;
}

export function isUrl(value: unknown): boolean {
  const s = String(value);
  return /^https?:\/\//i.test(s);
}
