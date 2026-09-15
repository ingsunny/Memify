import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MailCheck, KeyRound } from "lucide-react";
import { send } from "../api";
import { useStore } from "../store";
import { ErrorMessage } from "../components/ui";
export function AccountLink({ reset = false }: { reset?: boolean }) {
  const { refresh } = useStore();
  const [token] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("token") || "",
  );
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(reset ? "/auth/reset" : "/auth/verify", { token, password });
      history.replaceState(null, "", location.pathname);
      sessionStorage.removeItem("memify-verification");
      await refresh();
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-link panel">
      <span className="mini-mark">{reset ? <KeyRound /> : <MailCheck />}</span>
      <h1>
        {done
          ? reset
            ? "A fresh start."
            : "You’re all set."
          : reset
            ? "Choose a new password."
            : "One small step. All yours."}
      </h1>
      <p>
        {done
          ? reset
            ? "Your password has been updated. Sign in with your new password."
            : "Your email is verified. Your free generations are ready when you are."
          : reset
            ? "Use at least 10 characters for your new password."
            : "Confirm your email to unlock generation in your workspace."}
      </p>
      {done ? (
        <Link className="button primary" to={reset ? "/" : "/generate"}>
          Back to Memify
        </Link>
      ) : (
        <form className="stack" onSubmit={submit}>
          {reset && (
            <label>
              New password
              <input
                required
                type="password"
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          <ErrorMessage
            message={
              error ||
              (!token
                ? "This link is missing its token. Request a new email."
                : "")
            }
          />
          <button className="button primary" disabled={busy || !token}>
            {busy
              ? "One moment…"
              : reset
                ? "Update password"
                : "Verify my email"}
          </button>
        </form>
      )}
    </div>
  );
}
