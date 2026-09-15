import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { Deck, User, Review } from "./types";
type Store = {
  user: User | null;
  decks: Deck[];
  catalog: Deck[];
  reviews: Review[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  auth: (mode?: "login" | "signup") => void;
  authMode: "login" | "signup" | null;
  closeAuth: () => void;
  notify: (message: string) => void;
  notice: string;
};
const Context = createContext<Store>(null!);
export const useStore = () => useContext(Context);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [catalog, setCatalog] = useState<Deck[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [me, collections] = await Promise.all([
        api<{ user: User | null }>("/me"),
        api<Deck[]>("/catalog"),
      ]);
      setUser(me.user);
      setCatalog(collections);
      if (me.user) {
        const [saved, progress] = await Promise.all([
          api<Deck[]>("/decks"),
          api<Review[]>("/progress"),
        ]);
        setDecks(saved);
        setReviews(progress);
      } else {
        setDecks([]);
        setReviews([]);
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(id);
  }, [notice]);
  return (
    <Context.Provider
      value={{
        user,
        decks,
        catalog,
        reviews,
        loading,
        error,
        refresh,
        auth: (mode = "signup") => setAuthMode(mode),
        authMode,
        closeAuth: () => setAuthMode(null),
        notify: setNotice,
        notice,
      }}
    >
      {children}
    </Context.Provider>
  );
}
