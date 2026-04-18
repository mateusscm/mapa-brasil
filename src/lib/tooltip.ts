import type { GeoFeatureData } from "@/types/geo";

/**
 * Positions and populates the imperative tooltip element.
 * Uses direct DOM manipulation to avoid React re-renders on every mouse move.
 */
export function showTooltip(
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

/** Hides the tooltip by setting display:none */
export function hideTooltip(el: HTMLDivElement) {
  el.style.display = "none";
}
