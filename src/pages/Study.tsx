import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Check,
  Eye,
} from "lucide-react";
import { useStore } from "../store";
import { dueCards, type Card } from "../types";
import { send } from "../api";
import { Empty, ErrorMessage } from "../components/ui";
export function Study() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { decks, catalog, refresh } = useStore();
  const preview = params.has("preview");
  const quiz = params.get("mode") === "quiz";
  const sources = preview
    ? catalog.filter((d) => d.id === id)
    : id === "all"
      ? decks
      : decks.filter((d) => d.id === id);
  const [queue] = useState<Card[]>(() => {
    const due = sources.flatMap(dueCards);
    return quiz || preview || !due.length
      ? sources.flatMap((d) => d.cards)
      : due;
  });
  const [practice] = useState(
    () => quiz || preview || !sources.flatMap(dueCards).length,
  );
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [correct, setCorrect] = useState(0);
  const [requestId, setRequestId] = useState(crypto.randomUUID());
  const card = queue[index];
  const back = preview
    ? `/discover/${id}`
    : id === "all"
      ? "/"
      : `/decks/${id}`;
  async function rate(rating: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!practice)
        await send("/reviews", { cardId: card.id, rating, requestId });
      if (rating !== "again") setCorrect((n) => n + 1);
      setIndex((n) => n + 1);
      setRevealed(false);
      setAnswer("");
      setRequestId(crypto.randomUUID());
      if (index + 1 === queue.length) await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        ["INPUT", "TEXTAREA", "BUTTON"].includes(
          (e.target as HTMLElement).tagName,
        ) ||
        !card ||
        quiz ||
        busy
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setRevealed(true);
      }
      if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        void rate(["again", "hard", "good", "easy"][Number(e.key) - 1]);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  if (!queue.length)
    return (
      <Empty
        icon={<Sparkles size={30} />}
        title="A little breathing room."
        text="No cards here yet. Add a deck to start learning."
      >
        <Link to="/library" className="button primary">
          Go to your library
        </Link>
      </Empty>
    );
  if (!card)
    return (
      <section className="study-complete">
        <div className="completion-flower">✳</div>
        <span className="eyebrow">A SMALL WIN WORTH KEEPING</span>
        <h1>Look at you, growing.</h1>
        <p>
          You practiced {queue.length} ideas. That’s knowledge worth coming back
          to.
        </p>
        <div className="completion-stats">
          <div>
            <strong>{queue.length}</strong>
            <span>cards practiced</span>
          </div>
          <div>
            <strong>{correct}</strong>
            <span>recalled with confidence</span>
          </div>
        </div>
        <p className="small muted">
          {practice
            ? "Practice mode · your review schedule is unchanged."
            : "Your review schedule is updated. Cards marked “Again” return after a minute."}
        </p>
        <Link to={back} className="button primary">
          A good place to pause
          <ArrowRight size={17} />
        </Link>
      </section>
    );
  return (
    <div className="study-page">
      <div className="study-top">
        <Link to={back} className="back-link">
          <ArrowLeft size={17} />
          Finish later
        </Link>
        <span className="eyebrow">
          {quiz
            ? "ACTIVE RECALL"
            : practice
              ? "PRACTICE SESSION"
              : "A LITTLE FOCUSED PRACTICE"}
        </span>
        <span>
          {index + 1} <span className="muted">/ {queue.length}</span>
        </span>
      </div>
      <div className="study-progress">
        <span style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>
      <div className="study-caption">
        <Sparkles size={15} />
        {quiz
          ? "Find the words before you see them."
          : "Take a breath. See what comes back."}
      </div>
      <div className={`study-card ${revealed ? "is-revealed" : ""}`}>
        <span className="eyebrow">
          {revealed ? "THE IDEA TO KEEP" : "A MOMENT TO REMEMBER"}
        </span>
        <h2>{card.front}</h2>
        {revealed ? (
          <div className="answer-reveal">
            <div className="answer-divider" />
            <p>{card.back}</p>
            {quiz && (
              <div className="your-answer">
                <span className="eyebrow">YOUR ANSWER</span>
                <p>{answer}</p>
              </div>
            )}
          </div>
        ) : quiz ? (
          <textarea
            className="quiz-input"
            aria-label="Your answer"
            placeholder="Put the idea into your own words…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        ) : (
          <span className="card-thought">
            Think it through. There’s no rush.
          </span>
        )}
      </div>
      <ErrorMessage message={error} />
      {!revealed ? (
        <div className="reveal-controls">
          <button
            className="button primary"
            disabled={quiz && !answer.trim()}
            onClick={() => setRevealed(true)}
          >
            <Eye size={17} />
            {quiz ? "Compare your answer" : "Reveal the answer"}
          </button>
          {!quiz && (
            <p>
              or press <kbd>space</kbd>
            </p>
          )}
        </div>
      ) : (
        <div className="rating-controls">
          <p>
            {quiz
              ? "How did your answer compare? You know your learning best."
              : "How well did you remember?"}
          </p>
          <div className="rating-buttons">
            {(quiz
              ? [
                  ["again", "Keep practicing", RotateCcw],
                  ["good", "Got the idea", Check],
                ]
              : [
                  ["again", "Again", RotateCcw],
                  ["hard", "A little hard", ArrowLeft],
                  ["good", "Got it", Check],
                  ["easy", "Easy", Sparkles],
                ]
            ).map(([rating, label, Icon], i) => {
              const Component = Icon as typeof Check;
              return (
                <button
                  key={String(rating)}
                  disabled={busy}
                  className={`rating ${rating}`}
                  onClick={() => void rate(String(rating))}
                >
                  <Component size={17} />
                  <strong>{String(label)}</strong>
                  <span>
                    {quiz
                      ? "Self-assessed"
                      : practice
                        ? `Key ${i + 1}`
                        : [
                            "In 1 minute",
                            "A shorter interval",
                            "On schedule",
                            "A longer interval",
                          ][i]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
