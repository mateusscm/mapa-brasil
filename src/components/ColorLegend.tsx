interface ColorLegendProps {
  min?: number;
  max: number;
  label: string;
  gradientFrom: string;
  gradientTo: string;
}

/** Horizontal gradient legend bar with min/max labels */
export function ColorLegend({
  min = 0,
  max,
  label,
  gradientFrom,
  gradientTo,
}: ColorLegendProps) {
  return (
    <div className="flex items-center justify-center gap-2 mt-4 text-xs text-zinc-500">
      <span>{min}</span>
      <div
        className="h-3 w-40 rounded-sm"
        style={{
          background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`,
        }}
      />
      <span>{max}</span>
      <span className="ml-1">{label}</span>
    </div>
  );
}
