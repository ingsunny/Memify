import { useEffect, useState } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";

export type DeckView = "list" | "grid";

/**
 * Remembers the chosen layout per surface (library, discover) so the
 * preference survives navigation and reload. localStorage can throw in a
 * private window, so every access is guarded and falls back to the list.
 */
export function useDeckView(key: string): [DeckView, (v: DeckView) => void] {
  const storageKey = `memify:view:${key}`;
  const [view, setView] = useState<DeckView>(() => {
    try {
      return localStorage.getItem(storageKey) === "grid" ? "grid" : "list";
    } catch {
      return "list";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, view);
    } catch {
      /* storage unavailable; the choice just won't persist */
    }
  }, [storageKey, view]);
  return [view, setView];
}

export function ViewToggle({
  view,
  onChange,
}: {
  view: DeckView;
  onChange: (v: DeckView) => void;
}) {
  return (
    <div className="view-toggle" role="group" aria-label="Layout">
      <button
        className={view === "list" ? "active" : ""}
        aria-pressed={view === "list"}
        title="List view"
        onClick={() => onChange("list")}
      >
        <Rows3 size={15} />
        <span>List</span>
      </button>
      <button
        className={view === "grid" ? "active" : ""}
        aria-pressed={view === "grid"}
        title="Grid view"
        onClick={() => onChange("grid")}
      >
        <LayoutGrid size={15} />
        <span>Grid</span>
      </button>
    </div>
  );
}
