import { useEffect, useMemo, useRef, useState } from "react";
import * as icons from "lucide-react";
import { Search, X } from "lucide-react";
// This module pulls in the whole Lucide namespace (~1700 components), so
// it is imported lazily by DeckAppearance and lands in its own chunk.

type IconComponent = (typeof icons)["Layers"];

// lucide-react ships ~1700 icons. Filtering the namespace avoids adding
// a dependency just to enumerate them, and keeps the list in step with
// whatever version is installed.
const names = Object.keys(icons).filter(
  (key) =>
    /^[A-Z]/.test(key) &&
    key !== "Icon" &&
    !key.startsWith("Lucide") &&
    !key.endsWith("Icon") &&
    typeof (icons as Record<string, unknown>)[key] === "object",
);

export const iconCount = names.length;
export const getIcon = (name?: string): IconComponent =>
  ((icons as Record<string, unknown>)[name || ""] as IconComponent) ||
  icons.Layers;

// "GraduationCap" -> "graduation cap", so a plain-language search works.
const words = (name: string) =>
  name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
const searchable = names.map((name) => ({ name, text: words(name) }));

export function IconBrowser({
  selected,
  onSelect,
  close,
  floating = false,
}: {
  selected: string;
  onSelect: (name: string) => void;
  close: () => void;
  /** Rendered outside the dialog, docked beside it. */
  floating?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(120);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [close]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return searchable;
    return searchable.filter((i) => i.text.includes(term));
  }, [query]);

  useEffect(() => setLimit(120), [query]);

  return (
    <aside
      className={`icon-browser ${floating ? "floating" : ""}`}
      aria-label="Choose an icon"
    >
      <header>
        <strong className="browser-title">Choose an icon</strong>
        <button
          type="button"
          className="icon-button"
          aria-label="Close icon browser"
          onClick={close}
        >
          <X size={16} />
        </button>
      </header>
      <div className="browser-search">
        <div className="search-field">
          <Search size={15} />
          <input
            ref={input}
            value={query}
            aria-label="Search icons"
            placeholder={`Search ${iconCount} icons…`}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="icon-grid">
        {matches.slice(0, limit).map(({ name, text }) => {
          const Icon = getIcon(name);
          return (
            <button
              type="button"
              key={name}
              title={text}
              aria-label={text}
              aria-pressed={name === selected}
              className={name === selected ? "selected" : ""}
              onClick={() => {
                onSelect(name);
                close();
              }}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{text}</span>
            </button>
          );
        })}
      </div>
      {matches.length > limit ? (
        <button
          type="button"
          className="button secondary small-button full"
          onClick={() => setLimit((n) => n + 240)}
        >
          Show more ({matches.length - limit} left)
        </button>
      ) : (
        <p className="field-hint center">
          {matches.length
            ? `${matches.length} icon${matches.length === 1 ? "" : "s"}`
            : "No icons match that search."}
        </p>
      )}
    </aside>
  );
}
