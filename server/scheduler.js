// A transparent SM-2-inspired scheduler. Intervals are measured in whole days.
export function schedule(card, rating, now = Date.now()) {
  if (!["again", "hard", "good", "easy"].includes(rating))
    throw new Error("Invalid rating");
  let interval = card.interval || 0;
  let ease = card.ease || 2.5;
  let repetitions = card.repetitions || 0;
  if (rating === "again")
    return {
      interval: 0,
      ease: Math.max(1.3, ease - 0.2),
      repetitions: 0,
      due: now + 60_000,
    };
  if (rating === "hard") {
    interval = Math.max(1, Math.round(interval * 1.2));
    ease = Math.max(1.3, ease - 0.15);
  }
  if (rating === "good")
    interval =
      repetitions === 0
        ? 1
        : repetitions === 1
          ? 6
          : Math.round(interval * ease);
  if (rating === "easy") {
    interval = Math.max(4, Math.round(interval * ease * 1.3));
    ease = Math.min(3.5, ease + 0.15);
  }
  repetitions += 1;
  return {
    interval: Math.min(interval, 36500),
    ease,
    repetitions,
    due: now + Math.min(interval, 36500) * 86_400_000,
  };
}
