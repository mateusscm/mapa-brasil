import * as d3 from "d3";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import type { GeoFeatureData } from "@/types/geo";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Internal state shared across all canvas drawing operations */
export interface DrawState {
  geo: FeatureCollection;
  featureDataMap: Map<string, GeoFeatureData>;
  projection: d3.GeoProjection;
  colorScale: (v: number) => string;
  strokeColor: string;
  strokeWidth: number;
  hoverStrokeColor: string;
  hoverStrokeWidth: number;
  width: number;
  height: number;
  dpr: number;
  keyProp: string;
  colorToKey: Map<string, string>;
  keyToColor: Map<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extracts the identifying key from a GeoJSON feature's properties */
export function featureKey(feat: Feature, keyProp: string): string {
  return (feat.properties as Record<string, string>)?.[keyProp] ?? "";
}

/**
 * Builds two look-up maps that associate each feature with a unique RGB color.
 * Used for Canvas-based hit testing: the hidden canvas paints each feature
 * in its unique color so we can identify which feature is under the cursor.
 */
export function buildColorMaps(geo: FeatureCollection, keyProp: string) {
  const colorToKey = new Map<string, string>();
  const keyToColor = new Map<string, string>();
  let idx = 1;

  for (const feat of geo.features) {
    const key = featureKey(feat, keyProp) || String(idx);
    const r = (idx >> 16) & 0xff;
    const g = (idx >> 8) & 0xff;
    const b = idx & 0xff;
    colorToKey.set(`${r},${g},${b}`, key);
    keyToColor.set(key, `rgb(${r},${g},${b})`);
    idx++;
  }

  return { colorToKey, keyToColor };
}

// ─── Drawing functions ───────────────────────────────────────────────────────

/** Draws all features on the visible canvas, highlighting the hovered one */
export function drawMainCanvas(
  canvas: HTMLCanvasElement,
  state: DrawState,
  hoveredKey: string | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const {
    geo,
    featureDataMap,
    projection,
    colorScale,
    strokeColor,
    strokeWidth,
    hoverStrokeColor,
    hoverStrokeWidth,
    width,
    height,
    dpr,
    keyProp,
  } = state;

  const pathGen = d3.geoPath().projection(projection).context(ctx);

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  for (const feat of geo.features) {
    const key = featureKey(feat, keyProp);
    const data = featureDataMap.get(key);
    ctx.beginPath();
    pathGen(feat as Feature<Geometry>);
    ctx.fillStyle = colorScale(data?.value ?? 0);
    ctx.fill();
    ctx.strokeStyle = key === hoveredKey ? hoverStrokeColor : strokeColor;
    ctx.lineWidth = key === hoveredKey ? hoverStrokeWidth : strokeWidth;
    ctx.stroke();
  }

  // Re-draw hovered feature on top so the thick border isn't clipped
  if (hoveredKey) {
    const hovFeat = geo.features.find(
      (f) => featureKey(f, keyProp) === hoveredKey,
    );
    if (hovFeat) {
      const data = featureDataMap.get(hoveredKey);
      ctx.beginPath();
      pathGen(hovFeat as Feature<Geometry>);
      ctx.fillStyle = colorScale(data?.value ?? 0);
      ctx.fill();
      ctx.strokeStyle = hoverStrokeColor;
      ctx.lineWidth = hoverStrokeWidth;
      ctx.stroke();
    }
  }

  ctx.restore();
}

/** Draws the hidden hit-test canvas where each feature has a unique color */
export function drawHitCanvas(hitCanvas: HTMLCanvasElement, state: DrawState) {
  const { geo, projection, width, height, dpr, keyProp, keyToColor } = state;
  hitCanvas.width = width * dpr;
  hitCanvas.height = height * dpr;

  const ctx = hitCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  const pathGen = d3.geoPath().projection(projection).context(ctx);
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  for (const feat of geo.features) {
    const key = featureKey(feat, keyProp);
    const color = keyToColor.get(key);
    if (!color) continue;
    ctx.beginPath();
    pathGen(feat as Feature<Geometry>);
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.restore();
}

// ─── Hit testing ─────────────────────────────────────────────────────────────

/**
 * Determines which feature is under the given screen coordinates.
 * First checks the hidden color-coded canvas (fast), then falls back
 * to a geometric point-in-polygon test via d3.geoContains.
 */
export function hitTest(
  clientX: number,
  clientY: number,
  visibleCanvas: HTMLCanvasElement,
  hitCanvas: HTMLCanvasElement,
  state: DrawState,
): string | null {
  const { width, height, dpr, colorToKey, geo, projection, keyProp } = state;
  const rect = visibleCanvas.getBoundingClientRect();
  const scaleX = (width * dpr) / rect.width;
  const scaleY = (height * dpr) / rect.height;
  const px = Math.round((clientX - rect.left) * scaleX);
  const py = Math.round((clientY - rect.top) * scaleY);

  if (px < 0 || py < 0 || px >= width * dpr || py >= height * dpr) return null;

  // Fast path: read pixel from hit canvas
  const hitCtx = hitCanvas.getContext("2d", { willReadFrequently: true });
  if (hitCtx) {
    const pixel = hitCtx.getImageData(px, py, 1, 1).data;
    if (pixel[3] === 255) {
      const key = colorToKey.get(`${pixel[0]},${pixel[1]},${pixel[2]}`);
      if (key) return key;
    }
  }

  // Slow fallback: geometric point-in-polygon
  const cssX = (clientX - rect.left) * (width / rect.width);
  const cssY = (clientY - rect.top) * (height / rect.height);
  const lonLat = projection.invert?.([cssX, cssY]);
  if (!lonLat) return null;

  for (const feat of geo.features) {
    if (d3.geoContains(feat as Feature<Geometry>, lonLat)) {
      return featureKey(feat, keyProp);
    }
  }

  return null;
}
