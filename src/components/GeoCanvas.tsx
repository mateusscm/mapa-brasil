import { useEffect, useRef } from "react";
import type { FeatureCollection } from "geojson";
import type * as d3 from "d3";
import type { GeoFeatureData } from "@/types/geo";
import {
  buildColorMaps,
  drawHitCanvas,
  drawMainCanvas,
  hitTest,
  type DrawState,
} from "@/lib/canvas";
import { hideTooltip, showTooltip } from "@/lib/tooltip";

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
  tooltipLabel?: string;
  tooltipSubtitle?: string;
  onFeatureClick?: (key: string, data: GeoFeatureData) => void;
  /** Fire-and-forget callback on hover (do NOT setState here) */
  onFeatureHover?: (key: string | null, data: GeoFeatureData | null) => void;
  keyProp?: string;
}

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
