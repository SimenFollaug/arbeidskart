export interface GnrbnrQuery {
  kommuneRef: string;
  gnr: string;
  bnr: string;
}

/** Normaliser skråstrek/bindestrek og fjern overflødig mellomrom. */
function normalizeQuery(q: string): string {
  return q
    .trim()
    .replace(/[\u2044\u2215／]/g, "/")
    .replace(/\s+/g, " ");
}

/** Parser gnr/bnr: 4003-64/6, Skien/64/6, Skien-64/6, Skien 64/6 */
export function parseGnrbnrQuery(raw: string): GnrbnrQuery | null {
  const q = normalizeQuery(raw);

  const numeric = q.match(/^(\d{3,4})\s*[-/ ]\s*(\d+)\s*\/\s*(\d+)$/);
  if (numeric) {
    return {
      kommuneRef: numeric[1],
      gnr: numeric[2],
      bnr: numeric[3],
    };
  }

  const namedDash = q.match(
    /^([A-Za-zÀ-ÿÆØÅæøå .'-]+)\s*-\s*(\d+)\s*\/\s*(\d+)$/i,
  );
  if (namedDash) {
    return {
      kommuneRef: namedDash[1].trim(),
      gnr: namedDash[2],
      bnr: namedDash[3],
    };
  }

  const namedSlash = q.match(
    /^([A-Za-zÀ-ÿÆØÅæøå .'-]+)\s*\/\s*(\d+)\s*\/\s*(\d+)$/i,
  );
  if (namedSlash) {
    return {
      kommuneRef: namedSlash[1].trim(),
      gnr: namedSlash[2],
      bnr: namedSlash[3],
    };
  }

  const namedSpace = q.match(
    /^([A-Za-zÀ-ÿÆØÅæøå .'-]+)\s+(\d+)\s*\/\s*(\d+)$/i,
  );
  if (namedSpace) {
    return {
      kommuneRef: namedSpace[1].trim(),
      gnr: namedSpace[2],
      bnr: namedSpace[3],
    };
  }

  return null;
}
