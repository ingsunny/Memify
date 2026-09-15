import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Sparkles,
  ArrowRight,
  Layers,
  Check,
  WandSparkles,
  RefreshCw,
  CreditCard,
} from "lucide-react";
import { useStore } from "../store";
import { api, send } from "../api";
import type { CreditInfo, Deck } from "../types";
import { PageTitle, ErrorMessage } from "../components/ui";
import { DeckEditor } from "../components/DeckEditor";
export function Generate() {
  const { user, auth, notify } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [credits, setCredits] = useState<CreditInfo | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [payBusy, setPayBusy] = useState("");
  const [history, setHistory] = useState<
    {
      id: string;
      status: string;
      created: number;
      result: Partial<Deck> | null;
    }[]
  >([]);
  const [result, setResult] = useState<Partial<Deck> | null>(null);
  const [editing, setEditing] = useState(false);
  const [requestId, setRequestId] = useState(crypto.randomUUID());
  const [form, setForm] = useState({
    topic: "",
    level: "beginner",
    objective: "",
    description: "",
    count: 10,
    mode: "flashcards",
  });
  async function loadCredits() {
    if (!user) return;
    try {
      const [balance, recent] = await Promise.all([
        api<CreditInfo>("/credits"),
        api<typeof history>("/generations"),
      ]);
      setCredits(balance);
      setHistory(recent);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void loadCredits();
  }, [user]);
  useEffect(() => {
    if (params.get("payment") === "success")
      notify(
        "Payment submitted. Credits appear after payment confirmation. Use Refresh balance if they’re still arriving.",
      );
    if (params.get("payment") === "cancelled")
      notify("Checkout cancelled. You can return whenever you’re ready.");
  }, []);
  function update(key: string, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }));
    setRequestId(crypto.randomUUID());
  }
  async function generate(e: FormEvent) {
    e.preventDefault();
    if (!user) return auth();
    setError("");
    setBusy(true);
    try {
      const data = await send<Partial<Deck>>("/generate", {
        ...form,
        requestId,
      });
      setResult({ ...data, category: "AI generated", color: "lilac" });
      setRequestId(crypto.randomUUID());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      await loadCredits();
    }
  }
  async function checkout(pack: string) {
    if (!user) return auth();
    setPayBusy(pack);
    setError("");
    try {
      const { url } = await send<{ url: string }>("/checkout", {
        pack,
        requestId: crypto.randomUUID(),
      });
      window.location.assign(url);
    } catch (e) {
      setError((e as Error).message);
      setPayBusy("");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="A LITTLE HELP FOR YOUR NEXT BIG IDEA"
        title="Curiosity goes in. Knowledge comes out."
        description="Tell us what you want to learn. We’ll help you find the right questions."
      />
      <div className="generate-layout">
        <div>
          <form className="generation-form panel stack" onSubmit={generate}>
            <div className="section-heading">
              <h2>
                <WandSparkles size={22} />
                Let’s make something stick.
              </h2>
              <span className="pill muted-pill">1 credit per set</span>
            </div>
            <label>
              01 · What are we exploring?
              <input
                required
                maxLength={150}
                placeholder="e.g. The basics of human anatomy"
                value={form.topic}
                onChange={(e) => update("topic", e.target.value)}
              />
            </label>
            <div className="form-row">
              <label>
                02 · Your starting point
                <select
                  value={form.level}
                  onChange={(e) => update("level", e.target.value)}
                >
                  <option value="beginner">Just getting started</option>
                  <option value="intermediate">Know a little already</option>
                  <option value="advanced">Ready to go deeper</option>
                </select>
              </label>
              <label>
                03 · How many ideas?
                <select
                  value={form.count}
                  onChange={(e) => update("count", Number(e.target.value))}
                >
                  {[5, 10, 15, 20].map((n) => (
                    <option value={n} key={n}>
                      {n} cards
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              04 · What’s your goal?
              <input
                required
                maxLength={250}
                placeholder="e.g. Understand the major organ systems for my exam"
                value={form.objective}
                onChange={(e) => update("objective", e.target.value)}
              />
            </label>
            <label>
              05 · Give us a little context
              <textarea
                required
                maxLength={12000}
                rows={6}
                placeholder="Add your notes, describe what you’re studying, or tell us which ideas to focus on. The more specific, the better."
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
              <span className="field-hint">
                A description or your own notes ·{" "}
                {form.description.length.toLocaleString()} / 12,000
              </span>
            </label>
            <fieldset className="format-choice">
              <legend>How would you like to learn?</legend>
              <div className="choice-row">
                <button
                  type="button"
                  className={`choice ${form.mode === "flashcards" ? "selected" : ""}`}
                  onClick={() => update("mode", "flashcards")}
                >
                  <Layers size={20} />
                  <strong>Flashcards</strong>
                  <span>One idea. Both sides.</span>
                </button>
                <button
                  type="button"
                  className={`choice ${form.mode === "quiz" ? "selected" : ""}`}
                  onClick={() => update("mode", "quiz")}
                >
                  <Check size={20} />
                  <strong>Recall quiz</strong>
                  <span>Find your own words.</span>
                </button>
              </div>
            </fieldset>
            <ErrorMessage message={error} />
            {user && !user.verified && (
              <p className="info-note">
                One small step first:{" "}
                <Link to="/settings">verify your email</Link> to unlock your 3
                free generations.
              </p>
            )}
            {user && credits && !credits.connected && (
              <p className="info-note">
                Generation isn’t connected on this installation yet. You can
                create and study decks in your library.
              </p>
            )}
            {credits?.connected && !credits.generationReady && (
              <p className="info-note">
                The AI provider is not configured yet. No credits will be
                charged.
              </p>
            )}
            <button
              className="button primary full"
              disabled={
                busy ||
                Boolean(
                  user &&
                  (!user.verified ||
                    !credits?.connected ||
                    !credits?.generationReady),
                )
              }
            >
              {busy ? (
                <>
                  <span className="spinner" />
                  Finding the ideas worth keeping…
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  {user
                    ? "Generate my learning set"
                    : "Create an account to generate"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
            <p className="small muted center">
              Preview and edit before saving. AI can make mistakes—check
              important facts.
            </p>
            {error && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setRequestId(crypto.randomUUID());
                  setError("");
                }}
              >
                Start a fresh request
              </button>
            )}
          </form>
          {result && (
            <section className="panel generated-preview">
              <span className="eyebrow">
                YOUR IDEAS ARE READY · AI GENERATED
              </span>
              <h2>{result.title}</h2>
              <p>{result.description}</p>
              <div className="preview-pair">
                <span>FIRST QUESTION</span>
                <h3>{result.cards?.[0].front}</h3>
                <p>{result.cards?.[0].back}</p>
              </div>
              <button
                className="button primary"
                onClick={() => setEditing(true)}
              >
                Review all {result.cards?.length} cards & save
                <ArrowRight size={16} />
              </button>
            </section>
          )}
          {history.length > 0 && (
            <section className="panel generated-preview">
              <h2>Your recent generations</h2>
              <p className="small muted">
                A finished set stays here, even if you close the page.
              </p>
              <div className="generation-history">
                {history.map((item) => (
                  <div key={item.id}>
                    <div>
                      <strong>
                        {item.result?.title ||
                          (item.status === "pending"
                            ? "Generation in progress"
                            : "Generation refunded")}
                      </strong>
                      <small>{new Date(item.created).toLocaleString()}</small>
                    </div>
                    {item.result && (
                      <button
                        className="button secondary"
                        onClick={() => {
                          setResult({
                            ...item.result,
                            category: "AI generated",
                            color: "lilac",
                          });
                          setEditing(true);
                        }}
                      >
                        Review & save
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside className="generation-aside">
          <section className="credits-card">
            <span className="eyebrow">A LITTLE CREATIVE FUEL</span>
            <div className="credits-number">
              {user ? (credits?.balance ?? "—") : "3"}
              <Sparkles size={25} />
            </div>
            <h3>{user ? "generation credits" : "generations, on us."}</h3>
            <p>
              {user
                ? "One credit turns a topic into up to 20 learning cards."
                : "Start with 3 free generations after verifying your email. No card needed."}
            </p>
            {user && (
              <button
                className="text-button"
                onClick={() => void loadCredits()}
              >
                <RefreshCw size={14} />
                Refresh balance
              </button>
            )}
          </section>
          <section className="panel pricing-panel">
            <h3>Keep your curiosity going.</h3>
            <p className="small muted">One-time packs. No subscription.</p>
            {[
              { id: "small", credits: 49, price: 2 },
              { id: "large", credits: 100, price: 5 },
            ].map((p) => (
              <button
                key={p.id}
                disabled={
                  Boolean(payBusy) ||
                  Boolean(user && (!user.verified || !credits?.paymentsReady))
                }
                className="price-option"
                onClick={() => void checkout(p.id)}
              >
                <span>
                  <strong>{p.credits} credits</strong>
                  <small>Up to {p.credits * 20} cards</small>
                </span>
                <b>{payBusy === p.id ? "…" : `$${p.price}`}</b>
                <ArrowUpRightIcon />
              </button>
            ))}
            <p className="payment-note">
              <CreditCard size={13} />
              Secure checkout with Stripe
            </p>
          </section>
          <div className="generation-tip">
            <span>✦</span>
            <h3>
              A good question makes
              <br />a great beginning.
            </h3>
            <p>
              “Spanish verbs for a first trip to Madrid” gives us more to work
              with than “Spanish.” Make it personal.
            </p>
          </div>
        </aside>
      </div>
      {editing && result && (
        <DeckEditor
          deck={result}
          close={() => setEditing(false)}
          saved={(d) => {
            setResult(null);
            navigate(
              form.mode === "quiz"
                ? `/study/${d.id}?mode=quiz`
                : `/decks/${d.id}`,
            );
          }}
        />
      )}
    </>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={16} className="price-arrow" />;
}
