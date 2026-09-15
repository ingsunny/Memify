import { useCallback, useEffect, useRef, useState } from "react";
import {
  NotebookPen,
  Timer,
  AudioLines,
  X,
  Minus,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Lock,
} from "lucide-react";
import { useStore } from "../store";
import { api, send } from "../api";
import type { Note } from "../types";
import { useFloating, contain, viewport, type Geometry } from "./useFloating";
import { FocusAudio, tracks, type TrackId } from "./audio";

type PanelId = "notes" | "timer" | "sound";
type Layout = Partial<Record<PanelId, Geometry & { open?: boolean }>>;

const defaults: Record<PanelId, Geometry> = {
  notes: { x: 0, y: 0, w: 340, h: 380 },
  timer: { x: 0, y: 0, w: 268, h: 300 },
  sound: { x: 0, y: 0, w: 268, h: 286 },
};

const order: PanelId[] = ["notes", "timer", "sound"];

const presets = [
  { id: "classic", label: "25 / 5", focus: 25, rest: 5, pro: false },
  { id: "deep", label: "50 / 10", focus: 50, rest: 10, pro: true },
  { id: "sprint", label: "15 / 3", focus: 15, rest: 3, pro: true },
];

// Panels tile leftward from the dock so several can be open at once
// without covering one another. Each gets its own column, bottom-aligned
// above the dock; a narrow viewport falls back to a slight cascade.
const place = (id: PanelId, index: number): Geometry => {
  const d = defaults[id];
  const { width, height } = viewport();
  let x = width - d.w - 20;
  for (let i = 0; i < index; i++) x -= defaults[order[i]].w + 12;
  const cascade = x < 20;
  return contain({
    ...d,
    x: cascade ? width - d.w - 20 - index * 26 : x,
    y: height - d.h - 74 - (cascade ? index * 26 : 0),
  });
};

/** A floating panel: draggable by its bar, optionally resizable. */
function Panel({
  id,
  title,
  icon,
  geometry,
  onClose,
  children,
  resizable = true,
}: {
  id: PanelId;
  title: string;
  icon: React.ReactNode;
  geometry: Geometry;
  onClose: (g: Geometry, unmounting?: boolean) => void;
  children: React.ReactNode;
  resizable?: boolean;
}) {
  const {
    ref,
    geometry: g,
    onDragStart,
    onResizeStart,
  } = useFloating(geometry, {
    resizable,
    minW: 248,
    minH: resizable ? 220 : 180,
  });
  const latest = useRef(g);
  latest.current = g;
  // Persist the final geometry when the panel goes away for any reason
  // (closed here, or the user signed out) without re-entering close.
  const report = useRef(onClose);
  report.current = onClose;
  useEffect(() => () => report.current(latest.current, true), []);
  return (
    <section
      ref={ref}
      className={`float float-${id}`}
      style={{
        left: g.x,
        top: g.y,
        width: g.w,
        ...(resizable ? { height: g.h } : {}),
      }}
      aria-label={title}
    >
      <header className="float-bar" onPointerDown={onDragStart}>
        {icon}
        <strong>{title}</strong>
        <button
          className="float-close"
          aria-label={`Close ${title}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onClose(latest.current)}
        >
          <X size={14} />
        </button>
      </header>
      <div className="float-body">{children}</div>
      {resizable && (
        <span
          className="float-grip"
          onPointerDown={onResizeStart}
          aria-hidden="true"
        />
      )}
    </section>
  );
}

function Notes() {
  const { pro, plan, upgrade, notify } = useStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<number>(0);
  const maxTabs = plan?.limits.noteTabs ?? 1;

  useEffect(() => {
    void api<Note[]>("/notes")
      .then(async (list) => {
        if (list.length) return setNotes(list);
        const first = await send<Note>("/notes", {
          title: "Untitled",
          body: "",
        });
        setNotes([first]);
      })
      .catch(() => undefined);
  }, []);

  const persist = useCallback((note: Note) => {
    window.clearTimeout(timer.current);
    setSaving("saving");
    timer.current = window.setTimeout(() => {
      void send(
        `/notes/${note.id}`,
        { title: note.title, body: note.body },
        "PUT",
      )
        .then(() => setSaving("saved"))
        .catch(() => setSaving("idle"));
    }, 600);
  }, []);

  const update = (body: string) => {
    setNotes((list) => {
      const next = list.map((n, i) => (i === active ? { ...n, body } : n));
      // Derive the tab label from the first line so tabs stay meaningful
      // without asking the user to name anything.
      const current = next[active];
      const heading = body.trim().split("\n")[0]?.slice(0, 24);
      current.title = heading || "Untitled";
      persist(current);
      return next;
    });
  };

  const addTab = async () => {
    if (notes.length >= maxTabs)
      return upgrade(
        "Three note tabs, so a lecture, a question and a to-do can live side by side.",
      );
    try {
      const note = await send<Note>("/notes", { title: "Untitled", body: "" });
      setNotes((l) => [...l, note]);
      setActive(notes.length);
    } catch (e) {
      notify((e as Error).message);
    }
  };

  const note = notes[active];
  return (
    <div className="notes">
      <div className="note-tabs" role="tablist">
        {notes.map((n, i) => (
          <button
            key={n.id}
            role="tab"
            aria-selected={i === active}
            className={i === active ? "active" : ""}
            onClick={() => setActive(i)}
          >
            {n.title || "Untitled"}
          </button>
        ))}
        <button
          className="note-add"
          onClick={addTab}
          aria-label={
            notes.length >= maxTabs ? "More tabs with Pro" : "New note tab"
          }
          title={notes.length >= maxTabs ? "More tabs with Pro" : "New tab"}
        >
          {notes.length >= maxTabs && !pro ? (
            <Lock size={12} />
          ) : (
            <Plus size={13} />
          )}
        </button>
      </div>
      <textarea
        className="note-area"
        value={note?.body || ""}
        placeholder="Anything worth keeping…"
        aria-label="Note"
        onChange={(e) => update(e.target.value)}
      />
      <div className="note-foot">
        <span>
          {saving === "saving"
            ? "Saving…"
            : saving === "saved"
              ? "Saved"
              : "Autosaves"}
        </span>
        <span>
          {note?.body.trim() ? note.body.trim().split(/\s+/).length : 0} words
        </span>
      </div>
    </div>
  );
}

function Focus({ audio }: { audio: FocusAudio }) {
  const { pro, upgrade, notify } = useStore();
  const [preset, setPreset] = useState(presets[0]);
  const [resting, setResting] = useState(false);
  const [left, setLeft] = useState(presets[0].focus * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setLeft((v) => {
        if (v > 1) return v - 1;
        window.clearInterval(id);
        setRunning(false);
        void audio.chime();
        const wasFocus = !resting;
        if (wasFocus)
          void send("/focus", { minutes: preset.focus, kind: "focus" }).catch(
            () => undefined,
          );
        notify(
          wasFocus ? "Focus block done. Take the break." : "Break over. Ready?",
        );
        setResting(!wasFocus);
        return (wasFocus ? preset.rest : preset.focus) * 60;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, resting, preset, audio, notify]);

  const choose = (p: (typeof presets)[number]) => {
    if (p.pro && !pro)
      return upgrade("Longer and shorter focus blocks are part of Pro.");
    setPreset(p);
    setResting(false);
    setRunning(false);
    setLeft(p.focus * 60);
  };

  const total = (resting ? preset.rest : preset.focus) * 60;
  const progress = ((total - left) / total) * 100;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="focus">
      <div className="focus-presets">
        {presets.map((p) => (
          <button
            key={p.id}
            className={p.id === preset.id ? "active" : ""}
            onClick={() => choose(p)}
          >
            {p.label}
            {p.pro && !pro && <Lock size={9} />}
          </button>
        ))}
      </div>
      <div
        className={`focus-dial ${resting ? "resting" : ""}`}
        style={{ "--progress": `${progress}%` } as React.CSSProperties}
      >
        <div>
          <strong>
            {mm}:{ss}
          </strong>
          <span>{resting ? "break" : "focus"}</span>
        </div>
      </div>
      <div className="focus-controls">
        <button
          className="button small-button primary"
          onClick={() => setRunning((r) => !r)}
        >
          {running ? <Pause size={14} /> : <Play size={14} />}
          {running ? "Pause" : "Start"}
        </button>
        <button
          className="icon-button"
          aria-label="Reset timer"
          onClick={() => {
            setRunning(false);
            setResting(false);
            setLeft(preset.focus * 60);
          }}
        >
          <RotateCcw size={15} />
        </button>
      </div>
    </div>
  );
}

function Sound({ audio }: { audio: FocusAudio }) {
  const { pro, upgrade } = useStore();
  const [playing, setPlaying] = useState<TrackId | null>(null);
  const [volume, setVolume] = useState(0.45);

  useEffect(() => () => audio.stop(), [audio]);

  const toggle = async (id: TrackId, locked: boolean) => {
    if (locked) return upgrade("The full sound library comes with Pro.");
    if (playing === id) {
      audio.stop();
      return setPlaying(null);
    }
    await audio.play(id, volume);
    setPlaying(id);
  };

  return (
    <div className="sound">
      <ul className="sound-list">
        {tracks.map((t) => {
          const locked = t.pro && !pro;
          return (
            <li key={t.id}>
              <button
                className={playing === t.id ? "active" : ""}
                onClick={() => void toggle(t.id, locked)}
                aria-pressed={playing === t.id}
              >
                {playing === t.id ? <Pause size={13} /> : <Play size={13} />}
                <span>
                  {t.name}
                  <small>{t.detail}</small>
                </span>
                {locked && <Lock size={11} />}
              </button>
            </li>
          );
        })}
      </ul>
      <label className="sound-volume">
        <span className="field-hint">Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => {
            const v = Number(e.target.value) / 100;
            setVolume(v);
            audio.setVolume(v);
          }}
        />
      </label>
    </div>
  );
}

export function Workspace() {
  const { user } = useStore();
  const [layout, setLayout] = useState<Layout>({});
  const [open, setOpen] = useState<PanelId[]>([]);
  const audio = useRef(new FocusAudio()).current;
  const loaded = useRef(false);

  useEffect(() => {
    if (!user) {
      setOpen([]);
      setLayout({});
      loaded.current = false;
      return;
    }
    void api<Layout>("/workspace")
      .then((saved) => {
        setLayout(saved || {});
        setOpen(
          (Object.keys(saved || {}) as PanelId[]).filter(
            (k) => saved[k]?.open && defaults[k],
          ),
        );
        loaded.current = true;
      })
      .catch(() => {
        loaded.current = true;
      });
  }, [user]);

  const persist = useCallback(
    (next: Layout) => {
      if (!user || !loaded.current) return;
      void send("/workspace", { state: next }, "PUT").catch(() => undefined);
    },
    [user],
  );

  const toggle = (id: PanelId) => {
    setOpen((list) => {
      const isOpen = list.includes(id);
      const next = isOpen ? list.filter((p) => p !== id) : [...list, id];
      setLayout((l) => {
        const merged = {
          ...l,
          [id]: { ...(l[id] || place(id, next.length)), open: !isOpen },
        };
        persist(merged);
        return merged;
      });
      return next;
    });
  };

  const remember = (id: PanelId, g: Geometry, stillOpen: boolean) =>
    setLayout((l) => {
      const merged = { ...l, [id]: { ...g, open: stillOpen } };
      persist(merged);
      return merged;
    });

  if (!user) return null;
  const panels: {
    id: PanelId;
    title: string;
    icon: React.ReactNode;
    node: React.ReactNode;
    resizable: boolean;
  }[] = [
    {
      id: "notes",
      title: "Notes",
      icon: <NotebookPen size={14} />,
      node: <Notes />,
      resizable: true,
    },
    {
      id: "timer",
      title: "Focus",
      icon: <Timer size={14} />,
      node: <Focus audio={audio} />,
      resizable: false,
    },
    {
      id: "sound",
      title: "Sound",
      icon: <AudioLines size={14} />,
      node: <Sound audio={audio} />,
      resizable: false,
    },
  ];

  return (
    <>
      {panels
        .filter((p) => open.includes(p.id))
        .map((p, i) => (
          <Panel
            key={p.id}
            id={p.id}
            title={p.title}
            icon={p.icon}
            resizable={p.resizable}
            geometry={
              layout[p.id]
                ? contain({
                    x: layout[p.id]!.x,
                    y: layout[p.id]!.y,
                    w: layout[p.id]!.w,
                    h: layout[p.id]!.h,
                  })
                : place(p.id, i)
            }
            onClose={(g, unmounting) => {
              if (unmounting) return remember(p.id, g, open.includes(p.id));
              remember(p.id, g, false);
              setOpen((l) => l.filter((x) => x !== p.id));
            }}
          >
            {p.node}
          </Panel>
        ))}
      <div className="dock" role="toolbar" aria-label="Study tools">
        {panels.map((p) => (
          <button
            key={p.id}
            className={open.includes(p.id) ? "active" : ""}
            aria-pressed={open.includes(p.id)}
            title={p.title}
            onClick={() => toggle(p.id)}
          >
            {p.icon}
          </button>
        ))}
      </div>
    </>
  );
}
