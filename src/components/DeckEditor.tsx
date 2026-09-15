import { useState, type FormEvent } from "react";
import { Plus, Trash2, ArrowLeftRight } from "lucide-react";
import { Modal, ErrorMessage } from "./ui";
import { send } from "../api";
import { useStore } from "../store";
import type { Deck, Card } from "../types";
export function DeckEditor({
  deck,
  close,
  saved,
}: {
  deck?: Partial<Deck>;
  close: () => void;
  saved?: (deck: Deck) => void;
}) {
  const { refresh, notify } = useStore();
  const [title, setTitle] = useState(deck?.title || "");
  const [description, setDescription] = useState(deck?.description || "");
  const [category, setCategory] = useState(deck?.category || "Personal");
  const [color, setColor] = useState(deck?.color || "sage");
  const [cards, setCards] = useState<Card[]>(
    deck?.cards?.map((c) => ({ ...c })) || [{ front: "", back: "" }],
  );
  const [cloze, setCloze] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await send<Deck>(
        deck?.id ? `/decks/${deck.id}` : "/decks",
        { title, description, category, color, cards },
        deck?.id ? "PUT" : "POST",
      );
      await refresh();
      notify("Your deck is ready for a little discovery.");
      saved?.(result);
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function updateCard(index: number, key: "front" | "back", value: string) {
    setCards(cards.map((c, i) => (i === index ? { ...c, [key]: value } : c)));
  }
  return (
    <Modal
      title={deck?.id ? "Make it even better." : "A home for your next idea."}
      close={close}
      wide
    >
      <form className="stack" onSubmit={submit}>
        <div className="form-row">
          <label>
            Deck name
            <input
              required
              maxLength={100}
              placeholder="Something you’re curious about"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Category
            <input
              required
              maxLength={50}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </label>
        </div>
        <label>
          A little description
          <input
            maxLength={500}
            placeholder="What will you discover?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <fieldset className="color-picker">
          <legend>Give it a color</legend>
          {["sage", "peach", "lilac", "blue", "yellow"].map((c) => (
            <button
              type="button"
              key={c}
              aria-label={c}
              aria-pressed={c === color}
              className={`color-swatch ${c} ${c === color ? "selected" : ""}`}
              onClick={() => setColor(c)}
            />
          ))}
        </fieldset>
        <div className="section-heading">
          <h3>Your cards</h3>
          <span className="small muted">One idea at a time.</span>
        </div>
        <div className="editor-cards">
          {cards.map((c, i) => (
            <div className="editor-card" key={i}>
              <div className="editor-card-number">
                {String(i + 1).padStart(2, "0")}
                <div className="button-group">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Add reverse of card ${i + 1}`}
                    disabled={
                      !c.front.trim() ||
                      !c.back.trim() ||
                      c.back.length > 2000 ||
                      cards.length >= 500
                    }
                    onClick={() =>
                      setCards([...cards, { front: c.back, back: c.front }])
                    }
                  >
                    <ArrowLeftRight size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove card ${i + 1}`}
                    disabled={cards.length === 1}
                    onClick={() => setCards(cards.filter((_, n) => n !== i))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="form-row">
                <label>
                  Front · question
                  <textarea
                    required
                    maxLength={2000}
                    placeholder="What do you want to remember?"
                    value={c.front}
                    onChange={(e) => updateCard(i, "front", e.target.value)}
                  />
                </label>
                <label>
                  Back · answer
                  <textarea
                    required
                    maxLength={4000}
                    placeholder="The idea that makes it click."
                    value={c.back}
                    onChange={(e) => updateCard(i, "back", e.target.value)}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <button
          className="button secondary"
          type="button"
          disabled={cards.length >= 500}
          onClick={() => setCards([...cards, { front: "", back: "" }])}
        >
          <Plus size={17} />
          Add another card
        </button>
        <details className="cloze-builder">
          <summary>Make a fill-in-the-blank card</summary>
          <label>
            Put the missing idea inside double braces
            <textarea
              value={cloze}
              maxLength={2000}
              placeholder="The {{mitochondrion}} produces most of a cell’s ATP."
              onChange={(e) => setCloze(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="button secondary"
            disabled={!/\{\{[^{}]+\}\}/.test(cloze) || cards.length >= 500}
            onClick={() => {
              const front = cloze.replace(/\{\{([^{}]+)\}\}/g, "[…]");
              const back = cloze.replace(/\{\{([^{}]+)\}\}/g, "$1");
              setCards([
                ...cards.filter((c) => c.front.trim() || c.back.trim()),
                { front, back },
              ]);
              setCloze("");
            }}
          >
            Add fill-in-the-blank card
          </button>
        </details>
        <ErrorMessage message={error} />
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={close}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save deck"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
