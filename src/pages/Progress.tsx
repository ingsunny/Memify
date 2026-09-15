import { Flame, Target, Layers, TrendingUp } from "lucide-react";
import { useStore } from "../store";
import { PageTitle, Empty } from "../components/ui";
export function Progress() {
  const { user, reviews, decks, auth } = useStore();
  const days = Array.from({ length: 84 }, (_, i) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 83 + i);
    return {
      date,
      count: reviews.filter(
        (r) => new Date(r.created).toDateString() === date.toDateString(),
      ).length,
    };
  });
  let streak = 0;
  const activeDays = new Set(
    reviews.map((r) => new Date(r.created).toDateString()),
  );
  const cursor = new Date();
  if (!activeDays.has(cursor.toDateString()))
    cursor.setDate(cursor.getDate() - 1);
  while (activeDays.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const recalled = reviews.filter((r) => r.rating !== "again").length;
  const rate = reviews.length
    ? Math.round((recalled / reviews.length) * 100)
    : 0;
  return (
    <>
      <PageTitle
        eyebrow="SMALL EFFORTS ADD UP"
        title="Look how far you’re growing."
        description="Every return is a little victory. Here’s the shape of your practice."
      />
      {!user ? (
        <Empty
          icon={<TrendingUp size={32} />}
          title="Your story starts with a first step."
          text="Create an account to keep your progress and build a learning habit."
        >
          <button className="button primary" onClick={() => auth()}>
            Start your story
          </button>
        </Empty>
      ) : (
        <>
          <div className="progress-stats">
            {[
              [Flame, streak, "day streak"],
              [Layers, reviews.length, "reviews completed"],
              [Target, `${rate}%`, "recalled without “Again”"],
            ].map(([Icon, value, label], i) => {
              const Component = Icon as typeof Flame;
              return (
                <div className="panel progress-stat" key={i}>
                  <Component size={22} />
                  <strong>{String(value)}</strong>
                  <span>{String(label)}</span>
                </div>
              );
            })}
          </div>
          <section className="panel activity-panel">
            <div className="section-heading">
              <div>
                <h2>Your daily rhythm</h2>
                <p>84 days of making room for what matters.</p>
              </div>
              <span className="small muted">
                {reviews.length
                  ? "Keep a good thing going."
                  : "Your first review is a great place to start."}
              </span>
            </div>
            <div className="activity-grid">
              {days.map((d) => (
                <div
                  key={d.date.toISOString()}
                  tabIndex={0}
                  className={`activity-cell level-${Math.min(4, Math.ceil(d.count / 5))}`}
                  title={`${d.date.toLocaleDateString()}: ${d.count} reviews`}
                  aria-label={`${d.date.toLocaleDateString()}: ${d.count} reviews`}
                />
              ))}
            </div>
            <div className="activity-legend">
              <span>Less</span>
              {[0, 1, 2, 3, 4].map((n) => (
                <i className={`activity-cell level-${n}`} key={n} />
              ))}
              <span>More</span>
            </div>
          </section>
          <section className="panel">
            <h2>Ideas taking root</h2>
            <p className="muted">
              Cards you’ve successfully reviewed at least once.
            </p>
            <div className="deck-progress-list">
              {decks.length ? (
                decks.map((d) => {
                  const learned = d.cards.filter(
                    (c) => (c.repetitions || 0) > 0,
                  ).length;
                  return (
                    <div key={d.id}>
                      <span>{d.title}</span>
                      <div className="study-progress">
                        <span
                          style={{
                            width: `${(learned / d.cards.length) * 100}%`,
                          }}
                        />
                      </div>
                      <small>
                        {learned} / {d.cards.length}
                      </small>
                    </div>
                  );
                })
              ) : (
                <p className="muted">
                  Add a deck to watch your knowledge grow.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
