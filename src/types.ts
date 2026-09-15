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
