import { useCallback, useState, type FormEvent } from "react";
import { ArrowRight, ArrowLeft, Mail, Sparkles } from "lucide-react";
import { send } from "../api";
import { useStore } from "../store";
import { Modal, ErrorMessage } from "./ui";
export function Auth() {
  const store = useStore();
  const [step, setStep] = useState(0);
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [localLink, setLocalLink] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    topic: "",
    level: "Curious beginner",
    goal: 10,
  });
  const close = useCallback(() => store.closeAuth(), [store.closeAuth]);
  const signup = store.authMode === "signup";
  const update = (key: string, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (signup && step === 0 && !forgot) {
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      const result = await send<{ localLink?: string; emailError?: string }>(
        forgot ? "/auth/forgot" : signup ? "/auth/signup" : "/auth/login",
        forgot ? { email: form.email } : form,
      );
      if (forgot) {
        setMessage("If an account exists, a reset link is on its way.");
        setLocalLink(result.localLink || "");
      } else {
        if (result.localLink)
          sessionStorage.setItem("memify-verification", result.localLink);
        await store.refresh();
        store.notify(
          result.emailError ||
            (signup
              ? "Your workspace is ready. Let’s make something stick."
              : "Welcome back."),
        );
        store.closeAuth();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        forgot
          ? "A fresh start"
          : signup
            ? step
              ? "Make it yours."
              : "A little curiosity goes a long way."
            : "Good to have you back."
      }
      close={close}
    >
      <div className="auth-intro">
        <span className="mini-mark">
          <Sparkles size={22} />
        </span>
        <p>
          {forgot
            ? "We’ll send a password reset link to your email."
            : signup
              ? "Your next chapter starts with a few small steps."
              : "Pick up where your curiosity left off."}
        </p>
      </div>
      <form onSubmit={submit} className="stack">
        {forgot ? (
          <label>
            Email address
            <input
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </label>
        ) : step === 0 ? (
          <>
            {signup && (
              <label>
                What should we call you?
                <input
                  required
                  maxLength={60}
                  autoComplete="given-name"
                  placeholder="Your first name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </label>
            )}
            <label>
              Email address
              <input
                required
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                minLength={signup ? 10 : 1}
                maxLength={128}
                autoComplete={signup ? "new-password" : "current-password"}
                placeholder={
                  signup ? "At least 10 characters" : "Your password"
                }
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
              />
            </label>
            {!signup && (
              <button
                type="button"
                className="text-button align-right"
                onClick={() => setForgot(true)}
              >
                Forgot password?
              </button>
            )}
          </>
        ) : (
          <>
            <div className="step-label">A quick introduction · 2 of 2</div>
            <label>
              What are you curious about?
              <input
                maxLength={100}
                placeholder="Spanish, biology, a little bit of everything…"
                value={form.topic}
                onChange={(e) => update("topic", e.target.value)}
              />
            </label>
            <label>
              Where are you starting?
              <select
                value={form.level}
                onChange={(e) => update("level", e.target.value)}
              >
                <option>Curious beginner</option>
                <option>Building confidence</option>
                <option>Going deeper</option>
              </select>
            </label>
            <label>Your daily rhythm</label>
            <div className="choice-row">
              {[5, 10, 20].map((n) => (
                <button
                  type="button"
                  className={`choice ${form.goal === n ? "selected" : ""}`}
                  onClick={() => update("goal", n)}
                  key={n}
                >
                  <strong>{n} cards</strong>
                  <span>
                    {n === 5
                      ? "A small start"
                      : n === 10
                        ? "A steady habit"
                        : "A deeper dive"}
                  </span>
                </button>
              ))}
            </div>
            <p className="small muted">
              You can change this anytime. Consistency beats intensity.
            </p>
          </>
        )}
        <ErrorMessage message={error} />
        {message && (
          <p className="success-note">
            <Mail size={16} />
            {message}
          </p>
        )}
        {localLink && <a href={localLink}>Open local development email</a>}
        <button className="button primary full" disabled={busy}>
          {busy
            ? "One moment…"
            : forgot
              ? "Send reset link"
              : signup
                ? step
                  ? "Let’s get learning"
                  : "Continue"
                : "Sign in"}
          <ArrowRight size={17} />
        </button>
        {step === 1 && !forgot && (
          <button
            type="button"
            className="text-button"
            onClick={() => setStep(0)}
          >
            <ArrowLeft size={14} />
            Back
          </button>
        )}
      </form>
      <div className="auth-footer">
        {forgot ? (
          <button className="text-button" onClick={() => setForgot(false)}>
            Back to sign in
          </button>
        ) : (
          <>
            {signup ? "Already have an account?" : "New around here?"}{" "}
            <button
              className="text-button"
              onClick={() => {
                store.auth(signup ? "login" : "signup");
                setStep(0);
                setError("");
              }}
            >
              {signup ? "Sign in" : "Create an account"}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
