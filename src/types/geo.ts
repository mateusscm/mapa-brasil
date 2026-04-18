import type { FeatureCollection, Geometry } from "geojson";

/** Data associated with a single map feature (state or municipality) */
export interface GeoFeatureData {
  key: string;
  name: string;
  value: number;
  extra?: Record<string, unknown>;
}

/** Properties attached to each state feature in the GeoJSON */
export interface StateProperties {
  codarea: string;
  sigla: string;
  name: string;
}

/** Properties attached to each municipality feature in the GeoJSON */
export interface MunProperties {
  codarea: string;
  name?: string;
}

/** Discriminated union for the current map navigation state */
export type ViewMode =
  | { type: "country" }
  | {
      type: "state";
      sigla: string;
      stateName: string;
      geoData: FeatureCollection<Geometry, MunProperties>;
    };
