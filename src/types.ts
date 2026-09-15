export type User = {
  id: string;
  name: string;
  email: string;
  goal: number;
  topic: string;
  level: string;
  verified: boolean;
};
export type Card = {
  id?: string;
  front: string;
  back: string;
  due?: number;
  interval?: number;
  repetitions?: number;
};
export type Deck = {
  id: string;
  title: string;
  description: string;
  category: string;
  color: string;
  icon?: string;
  cards: Card[];
  source?: string;
};
export type Review = { rating: string; created: number };
export type CreditInfo = {
  connected: boolean;
  balance: number;
  generationReady?: boolean;
  paymentsReady?: boolean;
  packs: { id: string; cents: number; credits: number }[];
  history?: { amount: number; kind: string; created: number }[];
};
export const dueCards = (deck: Deck) =>
  deck.cards.filter((c) => (c.due || 0) <= Date.now());
export type PlanLimits = {
  noteTabs: number;
  decks: number | null;
  generationsPerMonth: number | null;
  maxCardsPerGeneration: number;
  publish: boolean;
  vote: boolean;
  timerPresets: string[];
  tracks: number | null;
};
export type PlanState = {
  pro: boolean;
  plan: string;
  status: string;
  renews: number | null;
  limits: PlanLimits;
  generationsUsed: number;
};
export type PlanOption = {
  id: string;
  label: string;
  rupees: number;
  months: number;
  perMonth: number;
  saving: number;
  note?: string;
  highlight?: boolean;
};
export type SharedDeck = {
  id: string;
  title: string;
  description: string;
  category: string;
  color: string;
  author: string;
  cardCount: number;
  votes: number;
  saves: number;
  created: number;
  mine: boolean;
  voted: boolean;
  cards?: Card[];
};
export type Note = {
  id: string;
  title: string;
  body: string;
  position: number;
  updated: number;
};
