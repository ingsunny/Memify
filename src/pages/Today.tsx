import {
  ArrowRight,
  ArrowUpRight,
  Flame,
  Layers,
  Sparkles,
  Target,
  Clock3,
  Check,
  Plus,
  Sprout,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "../store";
import { dueCards } from "../types";
import { DeckCard } from "../components/ui";
export function Today() {
  const { user, decks, catalog, reviews, auth } = useStore();
  const due = decks.reduce((n, d) => n + dueCards(d).length, 0);
  const today = new Date().toDateString();
  const completed = reviews.filter(
    (r) => new Date(r.created).toDateString() === today,
  ).length;
  const total = decks.reduce((n, d) => n + d.cards.length, 0);
  const goal = user?.goal || 10;
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    return {
      name: date.toLocaleDateString("en", { weekday: "narrow" }),
      active: reviews.some(
        (r) => new Date(r.created).toDateString() === date.toDateString(),
      ),
      today: i === 6,
    };
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow greeting-date">
            YOUR DAILY DOSE OF DISCOVERY
          </div>
          <h1>
            {user
              ? `A good day to grow, ${user.name.split(" ")[0]}.`
              : "A good day to grow."}
            <span className="heading-flower">✳</span>
          </h1>
          <p>A little practice today. A little more possibility tomorrow.</p>
        </div>
        <div className="date-chip">
          <span className="status-dot" />
          {new Date().toLocaleDateString("en", {
            month: "short",
            day: "numeric",
            weekday: "short",
          })}
        </div>
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-main">
          <section className="study-hero">
            <div className="hero-content">
              <span className="pill">
                <span className="status-dot" />
                {user
                  ? due
                    ? "YOUR NEXT SMALL WIN"
                    : "ROOM FOR SOMETHING NEW"
                  : "SMALL STEPS. LASTING KNOWLEDGE."}
              </span>
              <h2>
                {user && due ? (
                  <>
                    Your future self
                    <br />
                    will thank you.
                  </>
                ) : (
                  <>
                    Big ideas.
                    <br />
                    <em>Meet lasting memory.</em>
                  </>
                )}
              </h2>
              <p>
                {user ? (
                  due ? (
                    <>
                      You have <strong>{due} cards</strong> ready for a little
                      attention.
                      <br />
                      Let’s give those ideas a place to stay.
                    </>
                  ) : (
                    "You’re all caught up. Follow your curiosity and find your next favorite subject."
                  )
                ) : (
                  "Turn your curiosity into knowledge that stays. One thoughtful flashcard at a time."
                )}
              </p>
              {user ? (
                <Link
                  className="button dark"
                  to={due ? "/study/all" : "/discover"}
                >
                  {due ? "Start today’s review" : "Find something new"}
                  <ArrowRight size={17} />
                </Link>
              ) : (
                <button className="button dark" onClick={() => auth("signup")}>
                  Start your learning journey
                  <ArrowRight size={17} />
                </button>
              )}
              <div className="hero-footnote">
                <Clock3 size={13} />
                {due
                  ? `About ${Math.max(1, Math.ceil(due / 4))} minutes. All yours.`
                  : "A small habit with a lasting impact."}
              </div>
            </div>
            <div className="hero-illustration" aria-hidden="true">
              <span className="scribble sparkle-a">✦</span>
              <span className="scribble sparkle-b">✳</span>
              <div className="floating-card card-back-two" />
              <div className="floating-card card-back-one" />
              <div className="floating-card card-front">
                <span className="illustration-label">A LITTLE EVERY DAY</span>
                <div className="plant-illustration">
                  <div className="plant-stem" />
                  <i className="leaf leaf-one" />
                  <i className="leaf leaf-two" />
                  <i className="leaf leaf-three" />
                  <i className="leaf leaf-four" />
                  <div className="plant-ground" />
                </div>
                <span className="illustration-caption">
                  That’s how we grow.
                </span>
                <div className="illustration-dots">
                  <b />
                  <i />
                  <i />
                </div>
              </div>
              <span className="floating-note">
                <Check size={14} />
                Made to stick
              </span>
            </div>
          </section>
          <div className="stats-row">
            <div className="stat">
              <span className="stat-icon sage">
                <Layers size={19} />
              </span>
              <div>
                <strong>
                  {due}
                  <small>cards</small>
                </strong>
                <span>Ready to review</span>
              </div>
            </div>
            <div className="stat">
              <span className="stat-icon peach">
                <Check size={19} />
              </span>
              <div>
                <strong>
                  {completed}
                  <small>reviews</small>
                </strong>
                <span>Completed today</span>
              </div>
            </div>
            <div className="stat">
              <span className="stat-icon lilac">
                <Sprout size={19} />
              </span>
              <div>
                <strong>
                  {total}
                  <small>ideas</small>
                </strong>
                <span>In your collection</span>
              </div>
            </div>
          </div>
          <section className="section">
            <div className="section-heading">
              <div>
                <h2>
                  {user ? "Your learning, in motion" : "Find your next “aha.”"}
                </h2>
                <p>
                  {user
                    ? "Pick up a deck. Keep a good thing going."
                    : "A few thoughtful collections to get you started."}
                </p>
              </div>
              <Link
                className="text-button"
                to={user ? "/library" : "/discover"}
              >
                View all
                <ArrowRight size={15} />
              </Link>
            </div>
            <div className="deck-grid two">
              {(user && decks.length ? decks : catalog).slice(0, 2).map((d) => (
                <DeckCard
                  key={d.id}
                  deck={d}
                  discover={!user || !decks.length}
                />
              ))}
            </div>
          </section>
          <Link className="generation-banner" to="/generate">
            <span className="banner-spark">
              <Sparkles size={24} />
            </span>
            <div>
              <h3>From “I want to learn” to “I know this.”</h3>
              <p>Give us a topic. We’ll help you make the flashcards.</p>
            </div>
            <span className="round-arrow">
              <ArrowUpRight size={20} />
            </span>
          </Link>
        </div>
        <aside className="dashboard-aside">
          <section className="habit-panel">
            <div className="section-heading">
              <h3>A little, often.</h3>
              <Flame size={20} className="orange" />
            </div>
            <p>Make room for a daily discovery.</p>
            <div
              className="goal-ring"
              style={
                {
                  "--progress": `${Math.min(100, (completed / goal) * 100)}%`,
                } as React.CSSProperties
              }
            >
              <div>
                <span>
                  <strong>{completed}</strong>
                  <small> / {goal}</small>
                </span>
                <p>daily reviews</p>
              </div>
            </div>
            <div className="week-row">
              {week.map((d, i) => (
                <div key={i}>
                  <span>{d.name}</span>
                  <b
                    className={`${d.active ? "done" : ""} ${d.today ? "is-today" : ""}`}
                  >
                    {d.active ? <Check size={13} /> : d.today ? <span /> : "·"}
                  </b>
                </div>
              ))}
            </div>
            <div className="habit-note">
              <Target size={15} />
              {completed >= goal
                ? "Your daily goal? Done and dusted."
                : "Small steps are still steps forward."}
            </div>
          </section>
          <section className="learning-note">
            <span className="eyebrow">THE LEARNING CORNER</span>
            <span className="note-decoration" aria-hidden="true">
              ✺
            </span>
            <h3>
              A pause is
              <br />
              part of the process.
            </h3>
            <p>
              Spacing out your practice gives ideas time to settle. Come back
              tomorrow. Your brain is doing the quiet work.
            </p>
            <Link to="/discover/learning" className="text-button">
              Learn how to learn
              <ArrowUpRight size={15} />
            </Link>
          </section>
          <section className="quick-create">
            <span className="subtle-icon">
              <Plus size={20} />
            </span>
            <div>
              <h3>A thought worth keeping?</h3>
              <p>Give it a home in a new deck.</p>
            </div>
            <Link to="/library?create=true" aria-label="Create a deck">
              <ArrowUpRight size={19} />
            </Link>
          </section>
          <div className="aside-footer">
            <span className="tiny-flower">✳</span>
            <p>
              Made for curious minds.
              <br />
              Built to keep growing.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
