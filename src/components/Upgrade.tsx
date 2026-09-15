import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { useStore } from "../store";
import { api, send } from "../api";
import { Modal } from "./ui";
import type { PlanOption } from "../types";

const included = [
  "Unlimited AI sets, up to 100 cards at a time",
  "Unlimited decks and three note tabs",
  "Publish your decks to the shared library",
  "Every focus preset and the full sound library",
];

export function Upgrade() {
  const { upgradeReason, closeUpgrade, notify, refresh } = useStore();
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [chosen, setChosen] = useState("yearly");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ plans: PlanOption[] }>("/plan")
      .then((r) => setPlans(r.plans))
      .catch(() => undefined);
  }, []);

  const subscribe = async () => {
    setBusy(true);
    try {
      const result = await send<{ url?: string }>("/subscribe", {
        plan: chosen,
        requestId: crypto.randomUUID(),
      });
      if (result.url) return void (window.location.href = result.url);
      await refresh();
      notify("You're on Memify Pro.");
      closeUpgrade();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Go further with Pro" close={closeUpgrade} wide>
      {upgradeReason && <p className="upgrade-reason">{upgradeReason}</p>}
      <div className="plan-row">
        {plans.map((p) => (
          <button
            key={p.id}
            className={`plan-option ${chosen === p.id ? "selected" : ""} ${p.highlight ? "featured" : ""}`}
            onClick={() => setChosen(p.id)}
            aria-pressed={chosen === p.id}
          >
            {p.note && <span className="plan-flag">{p.note}</span>}
            <strong>{p.label}</strong>
            <b>₹{p.perMonth}</b>
            <small>per month</small>
            <span className="plan-total">
              ₹{p.rupees.toLocaleString("en-IN")}
              {p.months > 1
                ? ` billed every ${p.months} months`
                : " billed monthly"}
            </span>
            {p.saving > 0 && <em className="plan-save">Save {p.saving}%</em>}
          </button>
        ))}
      </div>
      <ul className="plan-includes">
        {included.map((line) => (
          <li key={line}>
            <Check size={14} />
            {line}
          </li>
        ))}
      </ul>
      <div className="modal-actions">
        <button className="button secondary" onClick={closeUpgrade}>
          Not now
        </button>
        <button
          className="button primary"
          onClick={() => void subscribe()}
          disabled={busy || !plans.length}
        >
          <Sparkles size={15} />
          {busy ? "Opening checkout…" : "Continue"}
        </button>
      </div>
    </Modal>
  );
}
