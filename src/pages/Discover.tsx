import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronUp, Layers, Compass, ArrowUpRight } from "lucide-react";
import { useStore } from "../store";
import { api, send } from "../api";
import { PageTitle, Empty, DeckIcon } from "../components/ui";
import { ViewToggle, useDeckView } from "../components/ViewToggle";
import { SearchFilter } from "../components/SearchFilter";
import type { SharedDeck } from "../types";

const sorts = [
  { id: "top", label: "Top" },
  { id: "new", label: "New" },
  { id: "trending", label: "Trending" },
];

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n);

export function VoteButton({
  deck,
  onChange,
}: {
  deck: SharedDeck;
  onChange: (votes: number, voted: boolean) => void;
}) {
  const { user, auth, notify } = useStore();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`vote ${deck.voted ? "voted" : ""}`}
      aria-pressed={deck.voted}
      aria-label={deck.voted ? "Remove your upvote" : "Upvote this collection"}
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) return auth("signup");
        setBusy(true);
        try {
          const r = await send<{ votes: number; voted: boolean }>(
            `/shared/${deck.id}/vote`,
          );
          onChange(r.votes, r.voted);
        } catch (err) {
          notify((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <ChevronUp size={15} />
      <b>{compact(deck.votes)}</b>
    </button>
  );
}

export function Discover() {
  const { notify } = useStore();
  const [decks, setDecks] = useState<SharedDeck[]>([]);
  const [categories, setCategories] = useState<
    { category: string; n: number }[]
  >([]);
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("top");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useDeckView("discover");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort });
      if (category !== "All") params.set("category", category);
      if (query.trim()) params.set("search", query.trim());
      const r = await api<{
        decks: SharedDeck[];
        categories: { category: string; n: number }[];
      }>(`/shared?${params}`);
      setDecks(r.decks);
      setCategories(r.categories);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [category, sort, query, notify]);

  useEffect(() => {
    const id = setTimeout(() => void load(), query ? 280 : 0);
    return () => clearTimeout(id);
  }, [load, query]);

  const total = categories.reduce((n, c) => n + c.n, 0);
  return (
    <>
      <PageTitle
        eyebrow="FOLLOW YOUR CURIOSITY"
        title="A world of little discoveries."
        description={`${total} collections, shared and ranked by people learning the same things.`}
      />
      <div className="library-toolbar">
        <SearchFilter
          categories={[
            { name: "All", count: total },
            ...categories.map((c) => ({ name: c.category, count: c.n })),
          ]}
          category={category}
          onCategory={setCategory}
          query={query}
          onQuery={setQuery}
        />
        <div className="toolbar-right">
          <ViewToggle view={view} onChange={setView} />
          <div className="sort-tabs" role="tablist" aria-label="Sort">
            {sorts.map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={sort === s.id}
                className={sort === s.id ? "active" : ""}
                onClick={() => setSort(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {loading ? (
        <div className="loading-state">
          <span className="spinner" />
          Gathering collections…
        </div>
      ) : !decks.length ? (
        <Empty
          icon={<Compass size={30} />}
          title="Nothing here yet."
          text="Try another topic, or be the first to publish a collection here."
        />
      ) : (
        <div className={view === "grid" ? "deck-grid" : "deck-list"}>
          {decks.map((deck) => {
            const vote = (
              <VoteButton
                deck={deck}
                onChange={(votes, voted) =>
                  setDecks((l) =>
                    l.map((d) =>
                      d.id === deck.id ? { ...d, votes, voted } : d,
                    ),
                  )
                }
              />
            );
            if (view === "list")
              return (
                <article
                  key={deck.id}
                  className={`deck-row shared ${deck.color}`}
                >
                  {vote}
                  <Link
                    className="row-glyph"
                    to={`/discover/${deck.id}`}
                    aria-label={`Open ${deck.title}`}
                  >
                    <DeckIcon size={20} />
                  </Link>
                  <span className="row-main">
                    <strong>
                      <Link to={`/discover/${deck.id}`}>{deck.title}</Link>
                    </strong>
                    <small>{deck.description}</small>
                  </span>
                  <span className="row-category">{deck.category}</span>
                  <span className="row-count">
                    <Layers size={13} />
                    {deck.cardCount}
                  </span>
                  <span className="row-author">by {deck.author}</span>
                  <ArrowUpRight size={16} className="row-arrow" />
                </article>
              );
            return (
              <article
                key={deck.id}
                className={`deck-card shared ${deck.color}`}
              >
                <Link
                  className="deck-art"
                  to={`/discover/${deck.id}`}
                  aria-label={`Open ${deck.title}`}
                >
                  <span className="deck-glyph">
                    <DeckIcon size={32} />
                  </span>
                  <span className="art-orbit orbit-one" />
                  <span className="art-orbit orbit-two" />
                </Link>
                <div className="deck-copy">
                  <span className="eyebrow">{deck.category}</span>
                  <h3>
                    <Link to={`/discover/${deck.id}`}>{deck.title}</Link>
                  </h3>
                  <p>{deck.description}</p>
                  <div className="deck-meta">
                    <span>
                      <Layers size={13} />
                      {deck.cardCount} cards
                    </span>
                    <span className="shared-author">by {deck.author}</span>
                  </div>
                  <div className="shared-actions">{vote}</div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
