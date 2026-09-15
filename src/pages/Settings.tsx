import { useState, type FormEvent } from "react";
import { Download, Check, Mail, LogOut } from "lucide-react";
import { useStore } from "../store";
import { api, send, download } from "../api";
import { PageTitle, ErrorMessage, Empty, Modal } from "../components/ui";
export function Settings() {
  const { user, refresh, auth, notify } = useStore();
  const [form, setForm] = useState({
    name: user?.name || "",
    goal: user?.goal || 10,
    topic: user?.topic || "",
    level: user?.level || "Curious beginner",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [localLink, setLocalLink] = useState(
    sessionStorage.getItem("memify-verification") || "",
  );
  if (!user)
    return (
      <Empty
        title="A workspace that feels like you."
        text="Sign in to manage your profile and learning preferences."
      >
        <button className="button primary" onClick={() => auth("login")}>
          Sign in
        </button>
      </Empty>
    );
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send("/me", form, "PATCH");
      await refresh();
      notify("Preferences saved. Make yourself at home.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError("");
    try {
      const result = await send<{ localLink?: string }>("/auth/resend");
      setLocalLink(result.localLink || "");
      notify("Verification email sent. Check your inbox.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await send("/auth/logout");
      sessionStorage.removeItem("memify-verification");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await send("/me", { password }, "DELETE");
      sessionStorage.removeItem("memify-verification");
      await refresh();
      setDeleting(false);
      notify("Your account and learning data have been deleted.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="MAKE YOURSELF AT HOME"
        title="Your own way to grow."
        description="A few little preferences for your learning space."
      />
      <div className="settings-layout">
        <form className="panel stack" onSubmit={save}>
          <h2>The essentials</h2>
          <label>
            Your name
            <input
              required
              maxLength={60}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            What you’re learning
            <input
              maxLength={100}
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            />
          </label>
          <label>
            Your starting point
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
            >
              <option>Curious beginner</option>
              <option>Building confidence</option>
              <option>Going deeper</option>
            </select>
          </label>
          <label>
            Daily goal · cards
            <input
              type="number"
              required
              min={1}
              max={120}
              value={form.goal}
              onChange={(e) =>
                setForm({ ...form, goal: Number(e.target.value) })
              }
            />
          </label>
          <ErrorMessage message={error} />
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save preferences"}
          </button>
        </form>
        <div className="stack">
          <section className="panel stack">
            <h2>Your account</h2>
            <p className="account-email">{user.email}</p>
            {user.verified ? (
              <span className="success-note">
                <Check size={17} />
                Email verified
              </span>
            ) : (
              <>
                <p className="small muted">
                  Verify your email to unlock your free generations.
                </p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={resend}
                >
                  <Mail size={16} />
                  Send verification email
                </button>
                {localLink && (
                  <a className="small" href={localLink}>
                    Open local development email
                  </a>
                )}
              </>
            )}
            <button className="button secondary" onClick={logout}>
              <LogOut size={16} />
              Sign out
            </button>
          </section>
          <section className="panel stack">
            <h2>Your knowledge is yours.</h2>
            <p className="small muted">
              Download your profile, decks, cards, and review history as JSON.
            </p>
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  download("memify-export.json", await api("/export"));
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <Download size={16} />
              Export my data
            </button>
          </section>
          <button
            className="text-button danger"
            onClick={() => {
              setError("");
              setDeleting(true);
            }}
          >
            Delete my account
          </button>
        </div>
      </div>
      {deleting && (
        <Modal
          title="Leave this workspace behind?"
          close={() => setDeleting(false)}
        >
          <form className="stack" onSubmit={remove}>
            <p>
              This permanently deletes your account, decks, and learning
              history. Unused credits are forfeited. Purchase records may be
              retained for accounting. Export your data first if you’d like a
              copy.
            </p>
            <label>
              Confirm your password
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <ErrorMessage message={error} />
            <button className="button destructive" disabled={busy}>
              Permanently delete account
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
