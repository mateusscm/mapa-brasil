import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { FeatureCollection, Feature, Geometry } from "geojson";

export interface GeoFeatureData {
  key: string;
  name: string;
  value: number;
  extra?: Record<string, unknown>;
}

interface GeoCanvasProps {
  geo: FeatureCollection;
  featureDataMap: Map<string, GeoFeatureData>;
  width: number;
  height: number;
  projection: d3.GeoProjection;
  colorScale: (value: number) => string;
  strokeColor?: string;
  strokeWidth?: number;
  hoverStrokeColor?: string;
  hoverStrokeWidth?: number;
  className?: string;
  /** Label shown after the value in tooltip (e.g. "projetos") */
  tooltipLabel?: string;
  /** Optional subtitle shown below the title */
  tooltipSubtitle?: string;
  onFeatureClick?: (key: string, data: GeoFeatureData) => void;
  /** Fire-and-forget callback on hover (do NOT setState here) */
  onFeatureHover?: (key: string | null, data: GeoFeatureData | null) => void;
  keyProp?: string;
}

// ─── Pure drawing helpers ────────────────────────────────────────────────────

interface DrawState {
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

function featureKey(feat: Feature, keyProp: string): string {
  return (feat.properties as Record<string, string>)?.[keyProp] ?? "";
}

function buildColorMaps(geo: FeatureCollection, keyProp: string) {
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

function drawMainCanvas(
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

function drawHitCanvas(hitCanvas: HTMLCanvasElement, state: DrawState) {
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

function hitTest(
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

  const hitCtx = hitCanvas.getContext("2d", { willReadFrequently: true });
  if (hitCtx) {
    const pixel = hitCtx.getImageData(px, py, 1, 1).data;
    if (pixel[3] === 255) {
      const key = colorToKey.get(`${pixel[0]},${pixel[1]},${pixel[2]}`);
      if (key) return key;
    }
  }

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

// ─── Imperative tooltip helpers ──────────────────────────────────────────────

function showTooltip(
  el: HTMLDivElement,
  x: number,
  y: number,
  data: GeoFeatureData,
  label: string,
  subtitle?: string,
) {
  el.style.display = "block";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const titleEl = el.children[0] as HTMLElement;
  const subtitleEl = el.children[1] as HTMLElement;
  const valueEl = el.children[2] as HTMLElement;

  titleEl.textContent = data.name;
  if (subtitle) {
    subtitleEl.textContent = subtitle;
    subtitleEl.style.display = "block";
  } else {
    subtitleEl.style.display = "none";
  }
  valueEl.innerHTML = `<span style="font-weight:500;color:#2563eb">${data.value}</span> ${label}`;
}

function hideTooltip(el: HTMLDivElement) {
  el.style.display = "none";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GeoCanvas({
  geo,
  featureDataMap,
  width,
  height,
  projection,
  colorScale,
  strokeColor = "#fff",
  strokeWidth = 0.5,
  hoverStrokeColor = "#1e40af",
  hoverStrokeWidth = 2,
  className,
  tooltipLabel = "projetos",
  tooltipSubtitle,
  onFeatureClick,
  onFeatureHover,
  keyProp = "codarea",
}: GeoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoveredKeyRef = useRef<string | null>(null);
  const stateRef = useRef<DrawState | null>(null);
  const rafRef = useRef<number>(0);
  // Stable ref for latest callbacks — avoids effect dependency on functions
  const callbacksRef = useRef({
    onFeatureHover,
    onFeatureClick,
    featureDataMap,
  });

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Keep callback refs up to date (cheap, no-op effect)
  useEffect(() => {
    callbacksRef.current = { onFeatureHover, onFeatureClick, featureDataMap };
  });

  // Heavy draw effect — depends only on data/geometry primitives
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hitCanvasRef.current) {
      hitCanvasRef.current = document.createElement("canvas");
    }

    const { colorToKey, keyToColor } = buildColorMaps(geo, keyProp);

    const state: DrawState = {
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
      colorToKey,
      keyToColor,
    };

    stateRef.current = state;
    hoveredKeyRef.current = null;
    drawHitCanvas(hitCanvasRef.current, state);
    drawMainCanvas(canvas, state, null);

    if (tooltipRef.current) hideTooltip(tooltipRef.current);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, width, height, keyProp]);

  // ─── Imperative event handlers (no setState, no re-renders) ──────────────

  function handleMouseMove(e: React.MouseEvent) {
    // rAF throttle — coalesce rapid mousemove to one update per frame
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (rafRef.current) return; // frame already scheduled
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;

      const state = stateRef.current;
      const canvas = canvasRef.current;
      const hitCanvas = hitCanvasRef.current;
      if (!state || !canvas || !hitCanvas) return;

      const key = hitTest(clientX, clientY, canvas, hitCanvas, state);
      const prev = hoveredKeyRef.current;

      if (key !== prev) {
        hoveredKeyRef.current = key;
        drawMainCanvas(canvas, state, key);
      }

      const { featureDataMap: fMap, onFeatureHover: onHover } =
        callbacksRef.current;
      const data = key ? (fMap.get(key) ?? null) : null;

      // Tooltip — pure DOM, no React state
      if (data && tooltipRef.current) {
        const rect = canvas.getBoundingClientRect();
        showTooltip(
          tooltipRef.current,
          clientX - rect.left + 14,
          clientY - rect.top - 14,
          data,
          tooltipLabel,
          tooltipSubtitle,
        );
      } else if (tooltipRef.current) {
        hideTooltip(tooltipRef.current);
      }

      // External side-effect callback (preloading etc, must NOT setState)
      onHover?.(key, data);
    });
  }

  function handleMouseLeave() {
    // Cancel any pending rAF to avoid stale updates
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const state = stateRef.current;
    const canvas = canvasRef.current;
    if (hoveredKeyRef.current && state && canvas) {
      hoveredKeyRef.current = null;
      drawMainCanvas(canvas, state, null);
    }
    if (tooltipRef.current) hideTooltip(tooltipRef.current);
    callbacksRef.current.onFeatureHover?.(null, null);
  }

  function handleClick(e: React.MouseEvent) {
    const state = stateRef.current;
    const canvas = canvasRef.current;
    const hitCanvas = hitCanvasRef.current;
    if (!state || !canvas || !hitCanvas) return;

    const key = hitTest(e.clientX, e.clientY, canvas, hitCanvas, state);
    if (key) {
      const data = callbacksRef.current.featureDataMap.get(key);
      if (data) callbacksRef.current.onFeatureClick?.(key, data);
    }
  }

  return (
    <div
      className={className}
      style={{ position: "relative", width: "fit-content" }}
    >
      <canvas
        ref={canvasRef}
        width={width * dpr}
        height={height * dpr}
        style={{ width, height, cursor: "pointer", display: "block" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      {/* Imperative tooltip — never re-rendered by React */}
      <div
        ref={tooltipRef}
        style={{
          display: "none",
          position: "absolute",
          pointerEvents: "none",
          zIndex: 50,
        }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg px-3 py-2 text-sm"
      >
        <p className="font-semibold text-zinc-900 dark:text-zinc-100" />
        <p className="text-xs text-zinc-500" />
        <p className="text-zinc-600 dark:text-zinc-400" />
      </div>
    </div>
  );
}
