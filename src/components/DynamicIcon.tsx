import { useEffect, useState, type ComponentType } from "react";
import { Layers } from "lucide-react";

type IconProps = { size?: number; strokeWidth?: number };
const cache = new Map<string, ComponentType<IconProps>>();

/**
 * Renders a Lucide icon by name without importing the whole namespace
 * into the main bundle. The chunk is fetched once, then cached, so a
 * grid of decks resolves after a single load.
 */
export function DynamicIcon({
  name,
  size = 26,
}: {
  name?: string;
  size?: number;
}) {
  const [Icon, setIcon] = useState<ComponentType<IconProps> | null>(
    () => cache.get(name || "") || null,
  );
  useEffect(() => {
    if (!name || cache.has(name)) return;
    let active = true;
    void import("lucide-react").then((mod) => {
      const found = (mod as Record<string, unknown>)[name] as
        ComponentType<IconProps> | undefined;
      if (!found) return;
      cache.set(name, found);
      if (active) setIcon(() => found);
    });
    return () => {
      active = false;
    };
  }, [name]);
  const Resolved = Icon || cache.get(name || "") || Layers;
  return <Resolved size={size} strokeWidth={1.6} />;
}
