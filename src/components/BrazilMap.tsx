import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { FeatureCollection, Geometry } from "geojson";
import type { ProjectData } from "@/data/mock-projects";
import { getStateProjectCounts } from "@/data/mock-projects";
import {
  fetchStateMunicipalities,
  preloadStateMunicipalities,
} from "@/lib/ibge";
import { cn } from "@/lib/utils";
import { GeoCanvas, type GeoFeatureData } from "./GeoCanvas";

interface StateProperties {
  codarea: string;
  sigla: string;
  name: string;
}

interface MunProperties {
  codarea: string;
  name?: string;
}

interface BrazilMapProps {
  data: ProjectData;
  width?: number;
  height?: number;
  className?: string;
}

type ViewMode =
  | { type: "country" }
  | {
      type: "state";
      sigla: string;
      stateName: string;
      geoData: FeatureCollection<Geometry, MunProperties>;
    };

export function BrazilMap({
  data,
  width = 800,
  height = 720,
  className,
}: BrazilMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [statesGeo, setStatesGeo] = useState<FeatureCollection<
    Geometry,
    StateProperties
  > | null>(null);
  const [view, setView] = useState<ViewMode>({ type: "country" });
  const [loading, setLoading] = useState(false);

  // Load states GeoJSON
  useEffect(() => {
    fetch("/geojson/brazil-states.json")
      .then((res) => res.json())
      .then((json: FeatureCollection<Geometry, StateProperties>) =>
        setStatesGeo(json),
      );
  }, []);

  // Preload top states by project count on idle
  useEffect(() => {
    const counts = getStateProjectCounts(data);
    const topStates = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([sigla]) => sigla);

    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(() => {
        for (const sigla of topStates) {
          preloadStateMunicipalities(sigla);
        }
      });
      return () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(() => {
        for (const sigla of topStates) {
          preloadStateMunicipalities(sigla);
        }
      }, 2000);
      return () => clearTimeout(id);
    }
  }, [data]);

  const stateCounts = getStateProjectCounts(data);

  const stateFeatureMap = (() => {
    const map = new Map<string, GeoFeatureData>();
    if (!statesGeo) return map;
    for (const feat of statesGeo.features) {
      const { codarea, sigla, name } = feat.properties;
      map.set(codarea, {
        key: codarea,
        name: `${name} (${sigla})`,
        value: stateCounts[sigla] ?? 0,
        extra: { sigla, stateName: name },
      });
    }
    return map;
  })();

  const stateValues = Object.values(stateCounts) as number[];
  const maxStateCount = Math.max(...stateValues, 1);

  function stateColorScale(value: number) {
    if (value === 0) return "#e2e8f0";
    const t = value / maxStateCount;
    return d3.interpolateBlues(0.15 + t * 0.75);
  }

  const countryProjection = d3
    .geoMercator()
    .center([-54, -15])
    .scale(width * 1.15)
    .translate([width / 2, height / 2]);

  // Fire-and-forget: preload on hover (no setState!)
  function handleStateHover(
    _key: string | null,
    featureData: GeoFeatureData | null,
  ) {
    if (!featureData) return;
    const sigla = featureData.extra?.sigla as string;
    if (sigla) preloadStateMunicipalities(sigla);
  }

  // Drill into state
  async function handleStateClick(_key: string, featureData: GeoFeatureData) {
    const sigla = featureData.extra?.sigla as string;
    const stateName = featureData.extra?.stateName as string;
    if (!sigla) return;

    setLoading(true);
    try {
      const { geo, nameMap } = await fetchStateMunicipalities(sigla);
      const fc = geo as FeatureCollection<Geometry, MunProperties>;
      for (const feat of fc.features) {
        feat.properties.name =
          nameMap.get(feat.properties.codarea) ?? feat.properties.codarea;
      }
      setView({ type: "state", sigla, stateName, geoData: fc });
    } catch (err) {
      console.error("Failed to load municipalities:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setView({ type: "country" });
  }

  if (!statesGeo || loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        {loading && (
          <p className="text-sm text-zinc-500">Carregando municípios...</p>
        )}
      </div>
    );
  }

  if (view.type === "state") {
    return (
      <StateView
        view={view}
        data={data}
        width={width}
        height={height}
        className={className}
        containerRef={containerRef}
        onBack={handleBack}
      />
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <GeoCanvas
        geo={statesGeo}
        featureDataMap={stateFeatureMap}
        width={width}
        height={height}
        projection={countryProjection}
        colorScale={stateColorScale}
        className="mx-auto block max-w-full"
        tooltipLabel="projetos"
        onFeatureClick={handleStateClick}
        onFeatureHover={handleStateHover}
      />

      <div className="flex items-center justify-center gap-2 mt-4 text-xs text-zinc-500">
        <span>0</span>
        <div
          className="h-3 w-40 rounded-sm"
          style={{
            background: `linear-gradient(to right, #e2e8f0, ${d3.interpolateBlues(0.9)})`,
          }}
        />
        <span>{maxStateCount}</span>
        <span className="ml-1">projetos</span>
      </div>
    </div>
  );
}

// ===== STATE VIEW COMPONENT =====
function StateView({
  view,
  data,
  width,
  height,
  className,
  containerRef,
  onBack,
}: {
  view: Extract<ViewMode, { type: "state" }>;
  data: ProjectData;
  width: number;
  height: number;
  className?: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onBack: () => void;
}) {
  const { sigla, stateName, geoData: munGeo } = view;
  const munData = data[sigla] ?? {};
  const munMax = Math.max(...Object.values(munData), 1);

  const stateProjection = d3.geoMercator().fitSize([width, height], munGeo);

  const munFeatureMap = (() => {
    const map = new Map<string, GeoFeatureData>();
    for (const feat of munGeo.features) {
      const code = feat.properties.codarea;
      const name = (feat.properties as MunProperties).name ?? code;
      const count = munData[name] ?? 0;
      map.set(code, { key: code, name, value: count });
    }
    return map;
  })();

  function munColorScale(value: number) {
    if (value === 0) return "#f1f5f9";
    const t = value / munMax;
    return d3.interpolateGreens(0.2 + t * 0.7);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Voltar ao mapa do Brasil
      </button>

      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-1 text-center">
        {stateName} ({sigla})
      </h2>
      <p className="text-xs text-zinc-500 text-center mb-3">
        {Object.values(munData).reduce((a, b) => a + b, 0)} projetos em{" "}
        {Object.keys(munData).length} municípios
      </p>

      <GeoCanvas
        geo={munGeo}
        featureDataMap={munFeatureMap}
        width={width}
        height={height}
        projection={stateProjection}
        colorScale={munColorScale}
        strokeColor="#cbd5e1"
        strokeWidth={0.3}
        className="mx-auto block max-w-full"
        tooltipLabel="projetos"
        tooltipSubtitle={`${stateName} (${sigla})`}
      />

      <div className="flex items-center justify-center gap-2 mt-4 text-xs text-zinc-500">
        <span>0</span>
        <div
          className="h-3 w-40 rounded-sm"
          style={{
            background: `linear-gradient(to right, #f1f5f9, ${d3.interpolateGreens(0.9)})`,
          }}
        />
        <span>{munMax}</span>
        <span className="ml-1">projetos</span>
      </div>

      {Object.keys(munData).length > 0 && (
        <div className="mt-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm max-w-md mx-auto">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Municípios com projetos
          </h3>
          <ul className="text-sm space-y-1 max-h-56 overflow-y-auto">
            {Object.entries(munData)
              .sort(([, a], [, b]) => b - a)
              .map(([mun, cnt]) => (
                <li
                  key={mun}
                  className="flex justify-between py-0.5 border-b border-zinc-50 dark:border-zinc-800 last:border-0"
                >
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {mun}
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {cnt}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
