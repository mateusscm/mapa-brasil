/** IBGE state code ↔ sigla mapping */
export const STATE_CODES: Record<string, string> = {
  RO: "11",
  AC: "12",
  AM: "13",
  RR: "14",
  PA: "15",
  AP: "16",
  TO: "17",
  MA: "21",
  PI: "22",
  CE: "23",
  RN: "24",
  PB: "25",
  PE: "26",
  AL: "27",
  SE: "28",
  BA: "29",
  MG: "31",
  ES: "32",
  RJ: "33",
  SP: "35",
  PR: "41",
  SC: "42",
  RS: "43",
  MS: "50",
  MT: "51",
  GO: "52",
  DF: "53",
};

export interface MunicipalityInfo {
  id: string;
  nome: string;
}

interface MunGeoFeature {
  type: string;
  properties: { codarea: string };
  geometry: unknown;
}

interface MunGeoJSON {
  type: string;
  features: MunGeoFeature[];
}

function rewindRing(coords: number[][], clockwise: boolean): number[][] {
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coords[i][0] * coords[j][1];
    area -= coords[j][0] * coords[i][1];
  }
  const isCW = area < 0;
  if (clockwise !== isCW) {
    coords.reverse();
  }
  return coords;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rewindGeometry(geom: any) {
  if (geom.type === "Polygon") {
    geom.coordinates[0] = rewindRing(geom.coordinates[0], true);
    for (let i = 1; i < geom.coordinates.length; i++) {
      geom.coordinates[i] = rewindRing(geom.coordinates[i], false);
    }
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) {
      poly[0] = rewindRing(poly[0], true);
      for (let i = 1; i < poly.length; i++) {
        poly[i] = rewindRing(poly[i], false);
      }
    }
  }
  return geom;
}

const geoCache = new Map<string, unknown>();
const namesCache = new Map<string, Map<string, string>>();
const inflightRequests = new Map<
  string,
  Promise<{ geo: unknown; nameMap: Map<string, string> }>
>();

export async function fetchStateMunicipalities(
  sigla: string,
): Promise<{ geo: unknown; nameMap: Map<string, string> }> {
  const code = STATE_CODES[sigla];
  if (!code) throw new Error(`Unknown state: ${sigla}`);

  // Deduplicate in-flight requests
  if (inflightRequests.has(sigla)) {
    return inflightRequests.get(sigla)!;
  }

  const promise = (async () => {
    // Fetch GeoJSON and municipality names in parallel
    const [geo, nameMap] = await Promise.all([
      geoCache.has(sigla)
        ? Promise.resolve(geoCache.get(sigla)!)
        : fetch(
            `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${code}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`,
          )
            .then((r) => r.json())
            .then((json: MunGeoJSON) => {
              // Rewind polygons for D3
              for (const feat of json.features) {
                feat.geometry = rewindGeometry(feat.geometry);
              }
              geoCache.set(sigla, json);
              return json;
            }),
      namesCache.has(sigla)
        ? Promise.resolve(namesCache.get(sigla)!)
        : fetch(
            `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${code}/municipios`,
          )
            .then((r) => r.json())
            .then((list: MunicipalityInfo[]) => {
              const map = new Map<string, string>();
              for (const m of list) {
                map.set(String(m.id), m.nome);
              }
              namesCache.set(sigla, map);
              return map;
            }),
    ]);

    return { geo, nameMap };
  })();

  inflightRequests.set(sigla, promise);
  try {
    return await promise;
  } finally {
    inflightRequests.delete(sigla);
  }
}

/** Preload municipality data for a state (fire-and-forget) */
export function preloadStateMunicipalities(sigla: string): void {
  if (geoCache.has(sigla) && namesCache.has(sigla)) return;
  fetchStateMunicipalities(sigla).catch(() => {});
}

/** Check if municipality data for a state is already cached */
export function isStateCached(sigla: string): boolean {
  return geoCache.has(sigla) && namesCache.has(sigla);
}
