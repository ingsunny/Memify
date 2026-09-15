import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  Sun,
  Layers,
  Compass,
  Sparkles,
  ChartNoAxesCombined,
  Settings2,
  ArrowUpRight,
  Menu,
  X,
  Search,
  ArrowRight,
} from "lucide-react";
import { useStore } from "./store";
import { Auth } from "./components/Auth";
import { Modal, Empty } from "./components/ui";
import { Today } from "./pages/Today";
import { Library } from "./pages/Library";
import { DeckDetail } from "./pages/DeckDetail";
import { Study } from "./pages/Study";
import { Generate } from "./pages/Generate";
import { Progress } from "./pages/Progress";
import { Settings } from "./pages/Settings";
import { AccountLink } from "./pages/AccountLink";
import { Discover } from "./pages/Discover";
import { SharedDeck } from "./pages/SharedDeck";
import { Workspace } from "./workspace/Workspace";
import { Upgrade } from "./components/Upgrade";
export default function App() {
  const {
    user,
    loading,
    error,
    refresh,
    auth,
    authMode,
    notice,
    decks,
    catalog,
    upgradeReason,
    pro,
    upgrade,
  } = useStore();
  const [menu, setMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState("");
  const location = useLocation();
  useEffect(() => {
    setMenu(false);
    setSearching(false);
    window.scrollTo(0, 0);
    const name = location.pathname.split("/")[1];
    document.title = `${name ? name.charAt(0).toUpperCase() + name.slice(1) : "Today"} · Memify`;
  }, [location.pathname]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearching((v) => !v);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {menu && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link className="brand" to="/" aria-label="Memify home">
          <img src="/favicon.svg" alt="" />
          <span>
            memify<span className="brand-period">.</span>
          </span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-flower">✳</span>
          <div>
            Your learning space<small>A little wiser, every day</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {[
            [Sun, "/", "Today"],
            [Layers, "/library", "My library"],
            [Compass, "/discover", "Discover"],
            [Sparkles, "/generate", "Generate"],
            [ChartNoAxesCombined, "/progress", "My progress"],
          ].map(([Icon, href, title]) => {
            const Component = Icon as typeof Sun;
            return (
              <NavLink key={String(href)} end={href === "/"} to={String(href)}>
                <Component size={19} strokeWidth={1.7} />
                <span>{String(title)}</span>
                {href === "/generate" && <span className="nav-new">AI</span>}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span>✦</span>
            <h3>Stay curious.</h3>
            <p>
              Your next “aha” is
              <br />
              one card away.
            </p>
            <Link to="/discover">
              Explore something new
              <ArrowUpRight size={14} />
            </Link>
          </div>
          {user && !pro && (
            <button
              className="sidebar-upgrade"
              onClick={() =>
                upgrade(
                  "Unlimited AI sets, unlimited decks, and every study tool.",
                )
              }
            >
              <Sparkles size={15} />
              <span>
                Go Pro<small>Unlimited AI, decks and tools</small>
              </span>
            </button>
          )}
          <NavLink className="settings-link" to="/settings">
            <Settings2 size={18} />
            Settings
          </NavLink>
          <div className="sidebar-user">
            <span className="avatar">
              {user?.name.charAt(0).toUpperCase() || "m"}
            </span>
            <div>
              <strong>{user?.name || "Hello, curious mind"}</strong>
              <small>
                {user ? "Your personal workspace" : "Make yourself at home"}
              </small>
            </div>
            {!user && (
              <button
                aria-label="Sign in"
                className="icon-button"
                onClick={() => auth("login")}
              >
                <ArrowRight size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span>Your workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>
              {location.pathname.startsWith("/decks")
                ? "My library"
                : location.pathname.startsWith("/study")
                  ? "A little practice"
                  : (
                      {
                        "/": "Today",
                        "/library": "My library",
                        "/discover": "Discover",
                        "/generate": "Generate",
                        "/progress": "My progress",
                        "/settings": "Settings",
                      } as Record<string, string>
                    )[location.pathname] || "Memify"}
            </strong>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              aria-label="Search workspace"
              onClick={() => setSearching(true)}
            >
              <Search size={16} />
              <span>Find anything</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="topbar-line" />
            {user ? (
              <Link
                to="/settings"
                className="avatar small-avatar"
                aria-label="Your account"
              >
                {user.name.charAt(0).toUpperCase()}
              </Link>
            ) : (
              <button
                className="button small-button secondary"
                onClick={() => auth("login")}
              >
                Sign in
                <ArrowUpRight size={14} />
              </button>
            )}
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {loading ? (
            <div className="loading-state">
              <span className="spinner" />
              Making a little space for learning…
            </div>
          ) : error ? (
            <Empty title="We couldn’t open your workspace." text={error}>
              <button className="button primary" onClick={() => void refresh()}>
                Try again
              </button>
            </Empty>
          ) : (
            <Routes>
              <Route path="/" element={<Today />} />
              <Route path="/library" element={<Library />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/discover/:id" element={<SharedDeck />} />
              <Route path="/decks/:id" element={<DeckDetail />} />
              <Route
                path="/study/:id"
                element={<Study key={location.pathname + location.search} />}
              />
              <Route path="/generate" element={<Generate />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/settings" element={<Settings key={user?.id} />} />
              <Route path="/verify-email" element={<AccountLink />} />
              <Route path="/reset-password" element={<AccountLink reset />} />
              <Route
                path="*"
                element={
                  <Empty
                    title="A little off the beaten path."
                    text="This page doesn’t exist, but there’s plenty to discover."
                  >
                    <Link className="button primary" to="/">
                      Back to today
                    </Link>
                  </Empty>
                }
              />
            </Routes>
          )}
        </main>
        <footer className="main-footer">
          <span>Small steps. Lasting knowledge.</span>
          <a
            href="https://github.com/ingsunny/Memify"
            target="_blank"
            rel="noreferrer"
          >
            Open source. Open possibilities.
            <ArrowUpRight size={12} />
          </a>
        </footer>
      </div>
      <Workspace />
      {upgradeReason !== null && <Upgrade />}
      {authMode && <Auth />}
      {notice && (
        <div className="toast" role="status">
          <span>✳</span>
          {notice}
        </div>
      )}
      {searching && (
        <Modal title="What’s on your mind?" close={() => setSearching(false)}>
          <div className="search-field large-search">
            <Search size={18} />
            <input
              autoFocus
              aria-label="Search your workspace"
              placeholder="Search decks and collections…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <X size={15} />
            </button>
          </div>
          <div className="search-results">
            {[
              ...decks.map((d) => ({ ...d, href: `/decks/${d.id}` })),
              ...catalog.map((d) => ({ ...d, href: `/discover/${d.id}` })),
            ]
              .filter((d) =>
                `${d.title} ${d.category}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((d) => (
                <Link key={d.href} to={d.href}>
                  <Layers size={18} />
                  <span>
                    {d.title}
                    <small>{d.category}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </Link>
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
