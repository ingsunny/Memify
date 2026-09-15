import { useCallback, useEffect, useRef, useState } from "react";

export type Geometry = { x: number; y: number; w: number; h: number };

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

// The root carries a CSS `zoom`, so a fixed element is positioned in
// zoomed CSS pixels while window.innerWidth reports unzoomed device
// pixels. Dividing by the zoom factor converts between the two; without
// this, panels are placed and clamped past the right/bottom edge.
export function viewport() {
  const zoom =
    Number(getComputedStyle(document.documentElement).zoom || 1) || 1;
  return {
    width: window.innerWidth / zoom,
    height: window.innerHeight / zoom,
  };
}

// Keeps a window on screen when the viewport changes, and leaves a
// margin so the title bar can always be grabbed again.
export function contain(g: Geometry): Geometry {
  const { width, height } = viewport();
  const maxX = Math.max(8, width - g.w - 8);
  const maxY = Math.max(8, height - g.h - 8);
  return { ...g, x: clamp(g.x, 8, maxX), y: clamp(g.y, 8, maxY) };
}

/**
 * Drag and resize driven by pointer events, so a stylus or touch works
 * the same as a mouse. Movement is written straight to the element's
 * style during the gesture and only committed to React state on release,
 * which keeps dragging smooth on a long note.
 */
export function useFloating(
  initial: Geometry,
  options: { minW?: number; minH?: number; resizable?: boolean } = {},
) {
  const { minW = 260, minH = 180, resizable = true } = options;
  const [geometry, setGeometry] = useState<Geometry>(initial);
  const ref = useRef<HTMLDivElement | null>(null);
  const live = useRef<Geometry>(initial);
  live.current = geometry;

  const paint = (g: Geometry) => {
    const el = ref.current;
    if (!el) return;
    el.style.left = `${g.x}px`;
    el.style.top = `${g.y}px`;
    if (resizable) {
      el.style.width = `${g.w}px`;
      el.style.height = `${g.h}px`;
    }
  };

  const gesture = useCallback(
    (event: React.PointerEvent, mode: "move" | "resize") => {
      if (event.button !== 0) return;
      event.preventDefault();
      const start = { x: event.clientX, y: event.clientY };
      const from = { ...live.current };
      const target = event.currentTarget as HTMLElement;
      target.setPointerCapture(event.pointerId);
      let next = from;
      const zoom =
        Number(getComputedStyle(document.documentElement).zoom || 1) || 1;
      const onMove = (e: PointerEvent) => {
        const dx = (e.clientX - start.x) / zoom;
        const dy = (e.clientY - start.y) / zoom;
        next = contain(
          mode === "move"
            ? { ...from, x: from.x + dx, y: from.y + dy }
            : {
                ...from,
                w: Math.max(minW, from.w + dx),
                h: Math.max(minH, from.h + dy),
              },
        );
        paint(next);
      };
      const onUp = () => {
        target.releasePointerCapture?.(event.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setGeometry(next);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [minW, minH, resizable],
  );

  useEffect(() => {
    const onResize = () => setGeometry((g) => contain(g));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    ref,
    geometry,
    setGeometry,
    onDragStart: (e: React.PointerEvent) => gesture(e, "move"),
    onResizeStart: (e: React.PointerEvent) => gesture(e, "resize"),
  };
}
