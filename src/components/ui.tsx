import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  X,
  Brain,
  Shapes,
  Languages,
  Code2,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { deckIcons } from "./DeckAppearance";
import { DynamicIcon } from "./DynamicIcon";
import type { Deck } from "../types";
import { dueCards } from "../types";
export function Modal({
  title,
  children,
  close,
  wide = false,
  scroll = true,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
  /** Children own the scroll region (a form with pinned actions). */
  scroll?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [docked, setDocked] = useState(false);
  const closeRef = useRef(close);
  closeRef.current = close;
  // Track whether the dock holds anything so the dialog can make room.
  const dockRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const observer = new MutationObserver(() =>
      setDocked(dock.childElementCount > 0),
    );
    observer.observe(dock, { childList: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = ref.current!;
    const previous = document.activeElement as HTMLElement;
    el.showModal();
    const cancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    el.addEventListener("cancel", cancel);
    return () => {
      el.removeEventListener("cancel", cancel);
      el.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""} ${docked ? "has-dock" : ""}`}
      aria-labelledby="dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-head">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {scroll ? <div className="modal-scroll">{children}</div> : children}
      {/* Anything docked beside the dialog renders here, so it shares the
          dialog's top layer instead of sitting under its backdrop. */}
      <div id="modal-dock" ref={dockRef} />
    </dialog>
  );
}
export function DeckIcon({
  icon,
  size = 26,
}: {
  icon?: string;
  size?: number;
}) {
  // Short keys come from the quick picks and render immediately; any
  // other value is a Lucide name resolved without loading the namespace.
  const Quick = deckIcons[icon as keyof typeof deckIcons];
  if (Quick) return <Quick size={size} strokeWidth={1.6} />;
  return <DynamicIcon name={icon} size={size} />;
}
export function DeckRow({
  deck,
  discover = false,
}: {
  deck: Deck;
  discover?: boolean;
}) {
  const due = dueCards(deck).length;
  return (
    <Link
      className={`deck-row ${deck.color}`}
      to={`${discover ? "/discover" : "/decks"}/${deck.id}`}
    >
      <span
        className={`row-glyph ${deck.banner ? "has-banner" : ""}`}
        style={
          deck.banner
            ? { backgroundImage: `url(${deck.banner})` }
            : deck.accent
              ? { background: deck.accent }
              : undefined
        }
      >
        <DeckIcon icon={deck.icon} size={20} />
      </span>
      <span className="row-main">
        <strong>{deck.title}</strong>
        <small>{deck.description}</small>
      </span>
      <span className="row-category">{deck.category}</span>
      <span className="row-count">
        <Layers size={13} />
        {deck.cards.length}
      </span>
      {discover ? (
        <span className="collection-label">Starter</span>
      ) : (
        <span className={due ? "due-label" : "muted"}>
          {due ? `${due} due` : "Caught up"}
        </span>
      )}
      <ArrowUpRight size={16} className="row-arrow" />
    </Link>
  );
}
export function DeckCard({
  deck,
  discover = false,
}: {
  deck: Deck;
  discover?: boolean;
}) {
  const due = dueCards(deck).length;
  return (
    <Link
      className={`deck-card ${deck.color}`}
      to={`${discover ? "/discover" : "/decks"}/${deck.id}`}
    >
      <div
        className={`deck-art ${deck.banner ? "has-banner" : ""}`}
        style={
          deck.banner
            ? { backgroundImage: `url(${deck.banner})` }
            : deck.accent
              ? { background: deck.accent }
              : undefined
        }
      >
        <span className="deck-glyph">
          <DeckIcon icon={deck.icon} size={34} />
        </span>
        <span className="art-orbit orbit-one" />
        <span className="art-orbit orbit-two" />
        <span className="card-corner">
          <ArrowUpRight size={18} />
        </span>
      </div>
      <div className="deck-copy">
        <span className="eyebrow">{deck.category}</span>
        <h3>{deck.title}</h3>
        <p>{deck.description}</p>
        <div className="deck-meta">
          <span>
            <Layers size={14} />
            {deck.cards.length} cards
          </span>
          {discover ? (
            <span className="collection-label">Starter collection</span>
          ) : (
            <span className={due ? "due-label" : "muted"}>
              {due ? `${due} to review` : "All caught up"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
export function Empty({
  icon,
  title,
  text,
  children,
}: {
  icon?: ReactNode;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p className="form-error" role="alert">
      {message}
    </p>
  ) : null;
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
