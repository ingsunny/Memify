// Pricing and entitlements live here so the server and the UI can never
// disagree about what a plan includes.
//
// Pricing ladder: each step up must lower the effective monthly rate,
// otherwise the longer plan is strictly worse and nobody buys it.
//   monthly   ₹299       = ₹299/mo   —
//   6 months  ₹1200      = ₹200/mo   save 33%
//   12 months ₹2000      = ₹167/mo   save 44%
// Anchoring on the monthly rate makes the yearly plan read as the
// obvious choice, which is where we want the commitment.
export const plans = {
  monthly: { id: "monthly", label: "Monthly", rupees: 299, months: 1 },
  halfYear: {
    id: "halfYear",
    label: "6 months",
    rupees: 1200,
    months: 6,
    note: "Most popular",
  },
  yearly: {
    id: "yearly",
    label: "12 months",
    rupees: 2000,
    months: 12,
    note: "Best value",
    highlight: true,
  },
};

// Pro is one switch: everything is included. The free tier stays a
// genuinely usable study app so an unpaid account is never broken —
// it just has ceilings.
export const limits = {
  free: {
    noteTabs: 1,
    decks: 6,
    generationsPerMonth: 3,
    maxCardsPerGeneration: 20,
    publish: false,
    vote: true,
    timerPresets: ["classic"],
    tracks: 2,
  },
  pro: {
    noteTabs: 3,
    decks: Infinity,
    generationsPerMonth: Infinity,
    maxCardsPerGeneration: 100,
    publish: true,
    vote: true,
    timerPresets: ["classic", "deep", "sprint", "custom"],
    tracks: Infinity,
  },
};

export const isPro = (subscription) =>
  Boolean(
    subscription &&
    subscription.plan !== "free" &&
    subscription.status === "active" &&
    (!subscription.renews || subscription.renews > Date.now()),
  );

export const entitlements = (subscription) =>
  isPro(subscription) ? limits.pro : limits.free;

export const publicPlans = () =>
  Object.values(plans).map((p) => ({
    ...p,
    perMonth: Math.round(p.rupees / p.months),
    saving: Math.round(
      100 - (p.rupees / (plans.monthly.rupees * p.months)) * 100,
    ),
  }));
