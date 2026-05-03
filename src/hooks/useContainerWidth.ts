import { useEffect, useRef, useState } from "react";

/**
 * Observes the width of a container element via ResizeObserver.
 * Returns [ref, width] — attach the ref to the container div.
 * Width is 0 until the first measurement (use as a loading guard).
 */
export function useContainerWidth(): [
  React.RefObject<HTMLDivElement | null>,
  number,
] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
