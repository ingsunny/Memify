import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Bookmark, Layers, Plus } from "lucide-react";
import { useStore } from "../store";
import { api, send } from "../api";
import { DeckIcon, Empty } from "../components/ui";
import { VoteButton } from "./Discover";
import type { SharedDeck as Shared } from "../types";

export function SharedDeck() {
  const { id } = useParams();
  const { user, notify, refresh, upgrade } = useStore();
  const [deck, setDeck] = useState<Shared | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<Shared>(`/shared/${id}`)
      .then(setDeck)
      .catch((e) => setError((e as Error).message));
  }, [id]);

  const save = async () => {
    if (!user) return notify("Sign in to keep a collection.");
    try {
      await send(`/shared/${id}/save`);
      await refresh();
      notify(`“${deck?.title}” is in your library.`);
    } catch (e) {
      const message = (e as Error).message;
      if (message.includes("Upgrade")) return upgrade(message);
      notify(message);
    }
  };

  if (error)
    return (
      <Empty title="This collection has moved on." text={error}>
        <Link className="button primary" to="/discover">
          Back to Discover
        </Link>
      </Empty>
    );
  if (!deck)
    return (
      <div className="loading-state">
        <span className="spinner" />
        Opening the collection…
      </div>
    );

  return (
    <>
      <Link className="back-link" to="/discover">
        <ArrowLeft size={15} />
        All collections
      </Link>
      <section className={`deck-detail-hero ${deck.color}`}>
        <span className="detail-icon">
          <DeckIcon size={44} />
        </span>
        <div>
          <span className="eyebrow">{deck.category}</span>
          <h1>{deck.title}</h1>
          <p>{deck.description}</p>
          <span className="small">
            <Layers size={13} /> {deck.cardCount} cards · shared by{" "}
            {deck.author} · {deck.saves.toLocaleString("en-IN")} saves
          </span>
        </div>
        <div className="detail-vote">
          <VoteButton
            deck={deck}
            onChange={(votes, voted) =>
              setDeck((d) => (d ? { ...d, votes, voted } : d))
            }
          />
        </div>
      </section>
      <div className="detail-toolbar">
        <button className="button primary" onClick={() => void save()}>
          <Plus size={16} />
          Save to my library
        </button>
        <Link className="button secondary" to={`/study/${deck.id}?preview`}>
          <Bookmark size={15} />
          Try these cards
        </Link>
      </div>
      <div className="section-heading">
        <h2>Inside this deck</h2>
        <span className="small muted">{deck.cardCount} flashcards</span>
      </div>
      <div className="card-list">
        {(deck.cards || []).map((card, i) => (
          <details key={i}>
            <summary>
              <span className="card-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              {card.front}
              <Plus size={16} />
            </summary>
            <p>{card.back}</p>
          </details>
        ))}
      </div>
    </>
  );
}
