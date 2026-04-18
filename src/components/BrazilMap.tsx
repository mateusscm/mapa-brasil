import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { FeatureCollection, Geometry } from "geojson";
import type {
  GeoFeatureData,
  StateProperties,
  MunProperties,
  ViewMode,
} from "@/types/geo";
import type { ProjectData } from "@/types/projects";
import { getStateProjectCounts } from "@/data/mock-projects";
import {
  fetchStateMunicipalities,
  preloadStateMunicipalities,
} from "@/lib/ibge";
import { cn } from "@/lib/utils";
import { GeoCanvas } from "./GeoCanvas";
import { ColorLegend } from "./ColorLegend";
import { StateView } from "./StateView";

interface BrazilMapProps {
  data: ProjectData;
  width?: number;
  height?: number;
  className?: string;
}

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

      <ColorLegend
        max={maxStateCount}
        label="projetos"
        gradientFrom="#e2e8f0"
        gradientTo={d3.interpolateBlues(0.9)}
      />
    </div>
  );
}
