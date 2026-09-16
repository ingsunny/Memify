import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Pencil,
  Trash2,
  Plus,
  Layers,
  Check,
  ChevronUp,
  Globe,
  Lock,
} from "lucide-react";
import { useStore } from "../store";
import { dueCards, type Deck } from "../types";
import { send, download } from "../api";
import { DeckEditor } from "../components/DeckEditor";
import { DeckIcon, Empty, Modal, ErrorMessage } from "../components/ui";
export function DeckDetail({ discover = false }: { discover?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, decks, catalog, auth, refresh, notify, upgrade } = useStore();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deck = (discover ? catalog : decks).find((d) => d.id === id);
  if (!deck)
    return (
      <Empty
        title="This deck isn’t here."
        text="It may have been removed, or you may need to sign in."
      >
        <Link className="button primary" to="/library">
          Back to your library
        </Link>
      </Empty>
    );
  const due = dueCards(deck).length;
  async function save() {
    if (!user) return auth();
    setBusy(true);
    try {
      const saved = await send<Deck>(`/catalog/${id}/save`);
      await refresh();
      notify("A new collection, all yours.");
      navigate(`/decks/${saved.id}`);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await send(`/decks/${id}`, {}, "DELETE");
      await refresh();
      navigate("/library");
      notify("Deck deleted.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function togglePublish() {
    // Captured locally: TypeScript cannot narrow the outer `deck` inside
    // a closure, even though the guard above has already returned.
    const current = deck!;
    setBusy(true);
    setError("");
    try {
      await send(`/decks/${current.id}/publish`, {
        publish: !current.published,
      });
      await refresh();
      notify(
        current.published
          ? "This deck is private again."
          : "Your deck is live in Discover.",
      );
    } catch (e) {
      const message = (e as Error).message;
      if (message.includes("Pro")) upgrade(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to={discover ? "/discover" : "/library"}>
        <ArrowLeft size={16} />
        {discover ? "All collections" : "Your library"}
      </Link>
      <section
        className={`deck-detail-hero ${deck.color} ${deck.banner ? "has-banner" : ""}`}
        style={
          deck.banner
            ? { backgroundImage: `url(${deck.banner})` }
            : deck.accent
              ? { background: deck.accent }
              : undefined
        }
      >
        <span className="detail-icon">
          <DeckIcon icon={deck.icon} size={48} />
        </span>
        <div>
          <span className="eyebrow">{deck.category}</span>
          <h1>{deck.title}</h1>
          <p>{deck.description}</p>
          <span className="small">
            <Layers size={14} /> {deck.cards.length} ideas to make your own
          </span>
        </div>
      </section>
      {!discover && (
        <div className="publish-row">
          {deck.published ? <Globe size={17} /> : <Lock size={17} />}
          <div>
            <strong>
              {deck.published ? "Public in Discover" : "Private to you"}
            </strong>
            <small>
              {deck.published
                ? "Anyone can find, upvote and save this deck."
                : "Only you can see this deck. Publish it to share."}
            </small>
          </div>
          {deck.published && (
            <span className="publish-stats">
              <ChevronUp size={13} />
              {deck.votes || 0} upvotes · {deck.saves || 0} saves
            </span>
          )}
          <button
            type="button"
            role="switch"
            className="switch"
            aria-checked={Boolean(deck.published)}
            aria-label={deck.published ? "Make private" : "Make public"}
            disabled={busy}
            onClick={() => void togglePublish()}
          >
            <span />
          </button>
        </div>
      )}
      <div className="detail-toolbar">
        <div className="button-group">
          {discover ? (
            <>
              <button className="button primary" disabled={busy} onClick={save}>
                <Plus size={17} />
                Save to my library
              </button>
              <Link
                className="button secondary"
                to={`/study/${id}?preview=true`}
              >
                Try these cards
                <ArrowRight size={16} />
              </Link>
            </>
          ) : (
            <>
              <Link className="button primary" to={`/study/${id}`}>
                {due ? `Review ${due} cards` : "Practice cards"}
                <ArrowRight size={17} />
              </Link>
              <Link className="button secondary" to={`/study/${id}?mode=quiz`}>
                Try a recall quiz
              </Link>
            </>
          )}
        </div>
        {!discover && (
          <div className="button-group">
            <button
              className="button secondary"
              onClick={() => setEditing(true)}
            >
              <Pencil size={15} />
              Edit
            </button>
            <button
              className="icon-button"
              aria-label="Export deck"
              onClick={() => download(`${deck.title}.json`, deck)}
            >
              <Download size={18} />
            </button>
            <button
              className="icon-button danger"
              aria-label="Delete deck"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>
      <div className="section-heading">
        <h2>Inside this deck</h2>
        <span className="small muted">{deck.cards.length} flashcards</span>
      </div>
      <div className="card-list">
        {deck.cards.map((card, i) => (
          <details key={card.id || i}>
            <summary>
              <span className="card-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{card.front}</span>
              {(card.repetitions || 0) > 0 && (
                <Check size={16} className="green" />
              )}
              <Plus size={17} />
            </summary>
            <p>{card.back}</p>
          </details>
        ))}
      </div>
      {editing && <DeckEditor deck={deck} close={() => setEditing(false)} />}{" "}
      {deleting && (
        <Modal title="Delete this deck?" close={() => setDeleting(false)}>
          <p>
            This permanently removes “{deck.title}” and its cards. You can
            export the deck first.
          </p>
          <ErrorMessage message={error} />
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setDeleting(false)}
            >
              Keep deck
            </button>
            <button
              className="button destructive"
              disabled={busy}
              onClick={remove}
            >
              Delete deck
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
