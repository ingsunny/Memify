import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { MailCheck, KeyRound, CircleCheck, CircleAlert } from "lucide-react";
import { send } from "../api";
import { useStore } from "../store";
import { ErrorMessage } from "../components/ui";

const REDIRECT_SECONDS = 5;

export function AccountLink({ reset = false }: { reset?: boolean }) {
  const { refresh } = useStore();
  const navigate = useNavigate();
  const [token] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("token") || "",
  );
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  const verify = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await send("/auth/verify", { token });
      history.replaceState(null, "", location.pathname);
      sessionStorage.removeItem("memify-verification");
      await refresh();
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [token, refresh]);

  // Clicking the link in the email is the confirmation; asking for a
  // second click on arrival is a step every large product has dropped.
  // A password reset still needs the form, since it collects input.
  const attempted = useRef(false);
  useEffect(() => {
    if (reset || !token || attempted.current) return;
    attempted.current = true;
    void verify();
  }, [reset, token, verify]);

  // Send verified users onward on their own, but leave the link visible
  // so nobody is stranded if the timer is interrupted.
  useEffect(() => {
    if (!done || reset) return;
    const tick = setInterval(
      () => setCountdown((n) => Math.max(0, n - 1)),
      1000,
    );
    const go = setTimeout(() => navigate("/"), REDIRECT_SECONDS * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(go);
    };
  }, [done, reset, navigate]);

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send("/auth/reset", { token, password });
      history.replaceState(null, "", location.pathname);
      await refresh();
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Verifying happens on arrival, so show progress rather than a form.
  if (!reset && !done && !error)
    return (
      <div className="account-link panel">
        <span className="mini-mark">
          <MailCheck />
        </span>
        <h1>Confirming your email…</h1>
        <p>
          {token
            ? "One moment while we finish setting up your account."
            : "This link is missing its token."}
        </p>
        {token ? (
          <span className="spinner" aria-label="Working" />
        ) : (
          <Link className="button primary" to="/">
            Back to Memify
          </Link>
        )}
      </div>
    );

  if (!reset && error)
    return (
      <div className="account-link panel">
        <span className="mini-mark warn">
          <CircleAlert />
        </span>
        <h1>This link didn’t work.</h1>
        <p>{error}</p>
        <div className="button-group">
          <Link className="button primary" to="/">
            Back to Memify
          </Link>
          <Link className="button secondary" to="/settings">
            Resend the email
          </Link>
        </div>
      </div>
    );

  if (!reset && done)
    return (
      <div className="account-link panel">
        <span className="mini-mark success">
          <CircleCheck />
        </span>
        <h1>You’re all set.</h1>
        <p>
          Your email is verified and your free generations are ready when you
          are.
        </p>
        <Link className="button primary" to="/">
          Go to my workspace
        </Link>
        <p className="redirect-note" role="status">
          {countdown > 0
            ? `Taking you there in ${countdown} second${countdown === 1 ? "" : "s"}…`
            : "Taking you there…"}
        </p>
      </div>
    );

  return (
    <div className="account-link panel">
      <span className={`mini-mark ${done ? "success" : ""}`}>
        {done ? <CircleCheck /> : <KeyRound />}
      </span>
      <h1>{done ? "A fresh start." : "Choose a new password."}</h1>
      <p>
        {done
          ? "Your password has been updated. Sign in with your new password."
          : "Use at least 10 characters for your new password."}
      </p>
      {done ? (
        <Link className="button primary" to="/">
          Back to Memify
        </Link>
      ) : (
        <form className="stack" onSubmit={submitReset}>
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
          <ErrorMessage
            message={
              error ||
              (!token
                ? "This link is missing its token. Request a new email."
                : "")
            }
          />
          <button className="button primary" disabled={busy || !token}>
            {busy ? "One moment…" : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}
