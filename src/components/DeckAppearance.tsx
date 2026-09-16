import { Suspense, lazy, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DynamicIcon } from "./DynamicIcon";
import { send } from "../api";
import {
  Layers,
  Brain,
  Shapes,
  Languages,
  Code2,
  Sparkles,
  FlaskConical,
  Globe,
  ImagePlus,
  Trash2,
  Palette,
  Image as ImageIcon,
  Grid3x3,
} from "lucide-react";
// Loaded only when the browser is opened, so the icon namespace stays
// out of the initial bundle.
const IconBrowser = lazy(() =>
  import("./IconBrowser").then((m) => ({ default: m.IconBrowser })),
);

export const deckIcons = {
  layers: Layers,
  brain: Brain,
  shapes: Shapes,
  languages: Languages,
  code: Code2,
  sparkles: Sparkles,
  flask: FlaskConical,
  globe: Globe,
};
export type DeckIconName = keyof typeof deckIcons;

// Quick picks stay in the panel; everything else lives in the browser.
const quickIcons: DeckIconName[] = [
  "layers",
  "brain",
  "shapes",
  "languages",
  "code",
  "sparkles",
];

export const palette = [
  { id: "sage", hex: "#cdeed8" },
  { id: "peach", hex: "#ffd9c4" },
  { id: "lilac", hex: "#e3d6fb" },
  { id: "blue", hex: "#cbe6f6" },
  { id: "yellow", hex: "#ffe6b8" },
];

/**
 * Uploads go straight from the browser to Cloudinary, but only with a
 * signature minted by our server for a signed-in account. The API secret
 * stays server-side, and the folder and timestamp are fixed when the
 * signature is made, so a caller cannot redirect the upload or reuse it
 * indefinitely.
 */
export async function uploadBanner(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 5_000_000) throw new Error("Choose an image under 5 MB.");
  const auth = await send<{
    cloudName: string;
    apiKey: string;
    folder: string;
    timestamp: string;
    signature: string;
  }>("/uploads/sign");
  const body = new FormData();
  body.append("file", file);
  body.append("api_key", auth.apiKey);
  body.append("timestamp", auth.timestamp);
  body.append("folder", auth.folder);
  body.append("signature", auth.signature);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${auth.cloudName}/image/upload`,
    { method: "POST", body },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url)
    throw new Error(data.error?.message || "That upload didn't finish.");
  return data.secure_url as string;
}

export function DeckAppearance({
  color,
  accent,
  icon,
  banner,
  title,
  onColor,
  onAccent,
  onIcon,
  onBanner,
  onError,
}: {
  color: string;
  accent: string;
  icon: string;
  banner: string;
  title: string;
  onColor: (v: string) => void;
  onAccent: (v: string) => void;
  onIcon: (v: string) => void;
  onBanner: (v: string) => void;
  onError: (message: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  // A deck has one background: a colour or an image, never both.
  const [mode, setMode] = useState<"color" | "image">(
    banner ? "image" : "color",
  );
  // Quick picks render instantly; a library icon resolves through the
  // lazy chunk so the preview reflects any of the 1743 choices.
  const Quick = deckIcons[icon as DeckIconName];
  const swatch =
    accent || palette.find((p) => p.id === color)?.hex || palette[0].hex;

  const pick = async (chosen?: File) => {
    if (!chosen) return;
    setUploading(true);
    try {
      onBanner(await uploadBanner(chosen));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  };

  const showImage = mode === "image";
  return (
    <section className="appearance">
      <div
        className={`appearance-preview ${color}`}
        style={
          showImage && banner
            ? { backgroundImage: `url(${banner})` }
            : !showImage && accent
              ? { background: accent }
              : undefined
        }
      >
        {showImage && banner && <span className="preview-scrim" />}
        <span className="deck-glyph">
          {Quick ? (
            <Quick size={30} strokeWidth={1.6} />
          ) : (
            <DynamicIcon name={icon} size={30} />
          )}
        </span>
        <span className="preview-title">{title || "Your deck"}</span>
      </div>
      <div className="appearance-controls">
        <div
          className="mode-switch"
          role="tablist"
          aria-label="Deck background"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!showImage}
            className={!showImage ? "active" : ""}
            onClick={() => {
              setMode("color");
              onBanner("");
            }}
          >
            <Palette size={14} />
            Colour
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showImage}
            className={showImage ? "active" : ""}
            onClick={() => setMode("image")}
          >
            <ImageIcon size={14} />
            Image
          </button>
        </div>

        {showImage ? (
          <fieldset className="banner-picker">
            <div className="button-group">
              <button
                type="button"
                className="button secondary small-button"
                disabled={uploading}
                onClick={() => file.current?.click()}
              >
                <ImagePlus size={14} />
                {uploading
                  ? "Uploading…"
                  : banner
                    ? "Replace image"
                    : "Upload an image"}
              </button>
              {banner && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Remove image"
                  onClick={() => onBanner("")}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            <span className="field-hint">
              Used as the deck banner. JPG or PNG, up to 5 MB.
            </span>
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void pick(e.target.files?.[0])}
            />
          </fieldset>
        ) : (
          <fieldset className="color-picker">
            {palette.map((p) => (
              <button
                type="button"
                key={p.id}
                aria-label={p.id}
                aria-pressed={!accent && p.id === color}
                className={`color-swatch ${p.id} ${!accent && p.id === color ? "selected" : ""}`}
                onClick={() => {
                  onColor(p.id);
                  onAccent("");
                }}
              />
            ))}
            <label
              className={`color-swatch custom ${accent ? "selected" : ""}`}
              style={accent ? { background: accent } : undefined}
              title="Choose any colour"
            >
              <input
                type="color"
                aria-label="Choose any colour"
                value={swatch}
                onChange={(e) => onAccent(e.target.value)}
              />
            </label>
          </fieldset>
        )}

        <fieldset className="icon-picker">
          <legend>Icon</legend>
          {quickIcons.map((name) => {
            const Option = deckIcons[name];
            return (
              <button
                type="button"
                key={name}
                aria-label={name}
                aria-pressed={name === icon}
                className={name === icon ? "selected" : ""}
                onClick={() => onIcon(name)}
              >
                <Option size={17} strokeWidth={1.7} />
              </button>
            );
          })}
          {/* A chosen library icon joins the row so the selection is
              visible without reopening the browser. */}
          {!Quick && icon && (
            <button
              type="button"
              aria-label={icon}
              aria-pressed
              className="selected"
              onClick={() => setBrowsing(true)}
            >
              <DynamicIcon name={icon} size={17} />
            </button>
          )}
          <span className="icon-divider" aria-hidden="true" />
          <button
            type="button"
            className={`icon-more ${browsing ? "open" : ""}`}
            aria-expanded={browsing}
            onClick={() => setBrowsing((v) => !v)}
          >
            <Grid3x3 size={15} />
            <span>
              Browse all<small>1,743</small>
            </span>
          </button>
        </fieldset>
      </div>
      {browsing &&
        // Rendered outside the dialog so it floats in the space beside
        // it rather than crowding the form.
        createPortal(
          <Suspense
            fallback={
              <div className="icon-browser floating is-loading">
                <span className="spinner" />
              </div>
            }
          >
            <IconBrowser
              floating
              selected={icon}
              onSelect={(name) => onIcon(name)}
              close={() => setBrowsing(false)}
            />
          </Suspense>,
          // The dialog's own dock keeps the panel in the top layer with
          // it; body would place it behind the backdrop.
          document.getElementById("modal-dock") || document.body,
        )}
    </section>
  );
}
