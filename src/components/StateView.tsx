import * as d3 from "d3";
import type { GeoFeatureData, MunProperties, ViewMode } from "@/types/geo";
import type { ProjectData } from "@/types/projects";
import { cn } from "@/lib/utils";
import { GeoCanvas } from "./GeoCanvas";
import { ColorLegend } from "./ColorLegend";

interface StateViewProps {
  view: Extract<ViewMode, { type: "state" }>;
  data: ProjectData;
  width: number;
  height: number;
  className?: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onBack: () => void;
}

export function StateView({
  view,
  data,
  width,
  height,
  className,
  containerRef,
  onBack,
}: StateViewProps) {
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

      <ColorLegend
        max={munMax}
        label="projetos"
        gradientFrom="#f1f5f9"
        gradientTo={d3.interpolateGreens(0.9)}
      />

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
