import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, Upload, Layers, Compass } from "lucide-react";
import { useStore } from "../store";
import { DeckCard, DeckRow, PageTitle, Empty } from "../components/ui";
import { ViewToggle, useDeckView } from "../components/ViewToggle";
import { DeckEditor } from "../components/DeckEditor";
import type { Deck } from "../types";
export function Library({ discover = false }: { discover?: boolean }) {
  const { user, decks, catalog, auth, notify } = useStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All topics");
  const [view, setView] = useDeckView(discover ? "discover" : "library");
  const [editing, setEditing] = useState<Partial<Deck> | null>(null);
  const [params, setParams] = useSearchParams();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (params.has("create")) {
      if (user) setEditing({});
      else auth("signup");
      setParams({}, { replace: true });
    }
  }, [params, user, auth, setParams]);
  const source = discover ? catalog : decks;
  const categories = ["All topics", ...new Set(source.map((d) => d.category))];
  const filtered = source.filter(
    (d) =>
      (category === "All topics" || d.category === category) &&
      `${d.title} ${d.description} ${d.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 3_000_000)
        throw new Error("Choose a JSON deck smaller than 3 MB.");
      const data = JSON.parse(await file.text());
      if (
        !Array.isArray(data.cards) ||
        data.cards.length < 1 ||
        data.cards.length > 500 ||
        data.cards.some(
          (c: { front: unknown; back: unknown }) =>
            typeof c.front !== "string" || typeof c.back !== "string",
        )
      )
        throw new Error(
          "Use a Memify JSON deck with a title and 1–500 front/back cards.",
        );
      setEditing({
        title: String(data.title || "Imported deck").slice(0, 100),
        description:
          typeof data.description === "string" ? data.description : "",
        cards: data.cards.map((c: { front: string; back: string }) => ({
          front: c.front,
          back: c.back,
        })),
      });
    } catch (e) {
      notify((e as Error).message);
    }
    if (input.current) input.current.value = "";
  }
  return (
    <>
      <PageTitle
        eyebrow={
          discover ? "FOLLOW YOUR CURIOSITY" : "YOUR PERSONAL KNOWLEDGE GARDEN"
        }
        title={
          discover ? "A world of little discoveries." : "Good ideas live here."
        }
        description={
          discover
            ? "Thoughtfully made starter collections. Find one that speaks to you."
            : "Everything you’re learning, with room for what comes next."
        }
      >
        {!discover && (
          <div className="button-group">
            <button
              className="button secondary"
              onClick={() => (user ? input.current?.click() : auth())}
            >
              <Upload size={16} />
              Import
            </button>
            <button
              className="button primary"
              onClick={() => (user ? setEditing({}) : auth())}
            >
              <Plus size={17} />
              Create a deck
            </button>
          </div>
        )}
      </PageTitle>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
      <div className="library-toolbar">
        <div className="filter-tabs">
          {categories.map((c) => (
            <button
              key={c}
              className={c === category ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <ViewToggle view={view} onChange={setView} />
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search decks"
              placeholder="Find a little inspiration…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>
      {filtered.length ? (
        <div className={view === "grid" ? "deck-grid" : "deck-list"}>
          {filtered.map((d) =>
            view === "grid" ? (
              <DeckCard key={d.id} deck={d} discover={discover} />
            ) : (
              <DeckRow key={d.id} deck={d} discover={discover} />
            ),
          )}
        </div>
      ) : (
        <Empty
          icon={<Layers size={32} />}
          title={
            query
              ? "No ideas found just yet."
              : "Your next chapter is a blank card."
          }
          text={
            query
              ? "Try a different word or topic."
              : "Create your first deck, or make a starter collection your own."
          }
        >
          <button
            className="button primary"
            onClick={() => (user ? setEditing({}) : auth())}
          >
            Create your first deck
            <Plus size={16} />
          </button>
          <Link className="button secondary" to="/discover">
            <Compass size={16} />
            Explore collections
          </Link>
        </Empty>
      )}
      {discover && (
        <div className="collection-footnote">
          <span>✳</span>
          <p>
            These original starter collections are free to explore.
            <br />
            Save one to your library and make it your own.
          </p>
        </div>
      )}
      {editing && <DeckEditor deck={editing} close={() => setEditing(null)} />}
    </>
  );
}
