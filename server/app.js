import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import { catalog } from "./catalog.js";
import { schedule } from "./scheduler.js";
import {
  checkPassword,
  hashPassword,
  hashToken,
  newToken,
  signedHeaders,
} from "./security.js";
import { createMailer } from "./mail.js";

const text = (max) => z.string().trim().min(1).max(max);
const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128);
const profileSchema = z.object({
  name: text(60),
  goal: z.number().int().min(1).max(120),
  topic: z.string().trim().max(100),
  level: z.enum(["Curious beginner", "Building confidence", "Going deeper"]),
});
const cardSchema = z.object({
  id: z.string().optional(),
  front: text(2000),
  back: text(4000),
});
const deckSchema = z.object({
  title: text(100),
  description: z.string().trim().max(500).default(""),
  category: text(50).default("Personal"),
  color: z.enum(["sage", "peach", "lilac", "blue", "yellow"]).default("sage"),
  cards: z.array(cardSchema).min(1).max(500),
});
const generationSchema = z.object({
  topic: text(150),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  objective: text(250),
  description: text(12000),
  count: z.number().int().min(1).max(20),
  mode: z.enum(["flashcards", "quiz"]),
  requestId: z.uuid(),
});
const fail = (status, message) => Object.assign(new Error(message), { status });
const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  goal: u.goal,
  topic: u.topic,
  level: u.level,
  verified: Boolean(u.verified),
});

export function createApp({
  db,
  config,
  mailer = createMailer(config),
  fetcher = fetch,
}) {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: config.production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:"],
              fontSrc: ["'self'"],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
    }),
  );
  app.use(express.json({ limit: "3mb" }));
  app.use(cookieParser());
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: config.test ? 10000 : 180,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Please try again in a minute." },
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") !== config.appOrigin
    )
      return res.status(403).json({ error: "Request origin is not allowed." });
    const token = req.cookies.memify_session;
    if (token)
      req.user = db
        .prepare(
          "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
        )
        .get(hashToken(token), Date.now());
    next();
  });
  const auth = (req, _res, next) =>
    req.user ? next() : next(fail(401, "Sign in to continue."));
  const authLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: config.test ? 10000 : 20,
    message: { error: "Too many attempts. Please try again in 15 minutes." },
  });
  const cookieOptions = {
    httpOnly: true,
    secure: config.production,
    sameSite: "lax",
    path: "/",
  };
  const session = (res, userId) => {
    const token = newToken();
    db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(
      hashToken(token),
      userId,
      Date.now() + 30 * 86400000,
    );
    res.cookie("memify_session", token, {
      ...cookieOptions,
      maxAge: 30 * 86400000,
    });
  };
  const sendToken = async (user, kind) => {
    const token = newToken();
    db.prepare("DELETE FROM tokens WHERE user_id=? AND kind=?").run(
      user.id,
      kind,
    );
    db.prepare("INSERT INTO tokens VALUES (?, ?, ?, ?)").run(
      hashToken(token),
      user.id,
      kind,
      Date.now() + 3600000,
    );
    const link = `${config.appOrigin}/${kind === "verify" ? "verify-email" : "reset-password"}#token=${token}`;
    const localLink = await mailer(user.email, kind, link);
    return !config.production && localLink ? { localLink } : {};
  };
  const insertDeck = db.transaction((userId, data, source = null) => {
    const id = randomUUID();
    const now = Date.now();
    db.prepare(
      "INSERT INTO decks (id,user_id,title,description,category,color,icon,source,created) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      userId,
      data.title,
      data.description || "",
      data.category || "Personal",
      data.color || "sage",
      data.icon || "layers",
      source,
      now,
    );
    const insert = db.prepare(
      "INSERT INTO cards (id,deck_id,front,back,due) VALUES (?,?,?,?,?)",
    );
    for (const card of data.cards)
      insert.run(randomUUID(), id, card.front, card.back, now);
    return id;
  });
  const deckFor = (userId, id) => {
    const deck = db
      .prepare("SELECT * FROM decks WHERE id=? AND user_id=?")
      .get(id, userId);
    if (!deck) throw fail(404, "Deck not found.");
    return {
      ...deck,
      cards: db
        .prepare("SELECT * FROM cards WHERE deck_id=? ORDER BY rowid")
        .all(id),
    };
  };
  app.get("/api/health", (_req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok" });
  });
  app.get("/api/catalog", (_req, res) =>
    res.json(
      catalog.map((d) => ({
        ...d,
        cards: d.cards.map(([front, back]) => ({ front, back })),
      })),
    ),
  );
  app.get("/api/me", (req, res) =>
    res.json({ user: req.user ? publicUser(req.user) : null }),
  );
  app.post("/api/auth/signup", authLimit, async (req, res) => {
    const data = profileSchema
      .extend({
        email: z
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
        password: passwordSchema,
      })
      .parse(req.body);
    if (db.prepare("SELECT 1 FROM users WHERE email=?").get(data.email))
      throw fail(
        409,
        "An account with this email already exists. Try signing in.",
      );
    const id = randomUUID();
    const password = await hashPassword(data.password);
    try {
      db.transaction(() => {
        db.prepare(
          "INSERT INTO users (id,email,password,name,goal,topic,level,created) VALUES (?,?,?,?,?,?,?,?)",
        ).run(
          id,
          data.email,
          password,
          data.name,
          data.goal,
          data.topic,
          data.level,
          Date.now(),
        );
        insertDeck(
          id,
          {
            ...catalog[0],
            cards: catalog[0].cards.map(([front, back]) => ({ front, back })),
          },
          "learning",
        );
      })();
    } catch (error) {
      if (error.code?.startsWith("SQLITE_CONSTRAINT"))
        throw fail(409, "An account with this email already exists.");
      throw error;
    }
    session(res, id);
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(id);
    let emailResult = {};
    try {
      emailResult = await sendToken(user, "verify");
    } catch {
      emailResult = {
        emailError:
          "Your account is ready, but the verification email could not be sent. Resend it in Settings.",
      };
    }
    res.status(201).json({ user: publicUser(user), ...emailResult });
  });
  const dummyHash = hashPassword("unused-password-for-timing");
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const data = z
      .object({ email: z.email().max(254), password: z.string().max(128) })
      .parse(req.body);
    const user = db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(data.email.toLowerCase());
    const valid = await checkPassword(
      data.password,
      user?.password || (await dummyHash),
    );
    if (!user || !valid) throw fail(401, "Email or password is incorrect.");
    session(res, user.id);
    res.json({ user: publicUser(user) });
  });
  app.post("/api/auth/logout", (req, res) => {
    if (req.cookies.memify_session)
      db.prepare("DELETE FROM sessions WHERE token=?").run(
        hashToken(req.cookies.memify_session),
      );
    res.clearCookie("memify_session", cookieOptions).json({ ok: true });
  });
  app.post("/api/auth/resend", authLimit, auth, async (req, res) =>
    res.json(
      req.user.verified
        ? { ok: true }
        : { ok: true, ...(await sendToken(req.user, "verify")) },
    ),
  );
  app.post("/api/auth/verify", authLimit, (req, res) => {
    const { token } = z.object({ token: text(128) }).parse(req.body);
    db.transaction(() => {
      const item = db
        .prepare("SELECT * FROM tokens WHERE token=? AND kind=? AND expires>?")
        .get(hashToken(token), "verify", Date.now());
      if (!item)
        throw fail(
          400,
          "This verification link has expired or was already used.",
        );
      db.prepare("UPDATE users SET verified=1 WHERE id=?").run(item.user_id);
      db.prepare("DELETE FROM tokens WHERE token=?").run(hashToken(token));
    })();
    res.json({ ok: true });
  });
  app.post("/api/auth/forgot", authLimit, async (req, res) => {
    const { email } = z.object({ email: z.email().max(254) }).parse(req.body);
    const user = db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(email.toLowerCase());
    let result = {};
    if (user) {
      try {
        result = await sendToken(user, "reset");
      } catch {
        console.error("Password reset delivery failed");
      }
    }
    res.json({ ok: true, ...result });
  });
  app.post("/api/auth/reset", authLimit, async (req, res) => {
    const { token, password } = z
      .object({ token: text(128), password: passwordSchema })
      .parse(req.body);
    const hashed = await hashPassword(password);
    db.transaction(() => {
      const item = db
        .prepare("SELECT * FROM tokens WHERE token=? AND kind=? AND expires>?")
        .get(hashToken(token), "reset", Date.now());
      if (!item)
        throw fail(400, "This reset link has expired or was already used.");
      db.prepare("UPDATE users SET password=? WHERE id=?").run(
        hashed,
        item.user_id,
      );
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(item.user_id);
      db.prepare("DELETE FROM tokens WHERE user_id=? AND kind=?").run(
        item.user_id,
        "reset",
      );
    })();
    res.clearCookie("memify_session", cookieOptions).json({ ok: true });
  });
  app.patch("/api/me", auth, (req, res) => {
    const data = profileSchema.parse(req.body);
    db.prepare("UPDATE users SET name=?,goal=?,topic=?,level=? WHERE id=?").run(
      data.name,
      data.goal,
      data.topic,
      data.level,
      req.user.id,
    );
    res.json({
      user: publicUser(
        db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id),
      ),
    });
  });
  app.get("/api/decks", auth, (req, res) =>
    res.json(
      db
        .prepare("SELECT id FROM decks WHERE user_id=? ORDER BY created DESC")
        .all(req.user.id)
        .map((d) => deckFor(req.user.id, d.id)),
    ),
  );
  app.post("/api/decks", auth, (req, res) => {
    const data = deckSchema.parse(req.body);
    const id = insertDeck(req.user.id, data);
    res.status(201).json(deckFor(req.user.id, id));
  });
  app.post("/api/catalog/:id/save", auth, (req, res) => {
    const source = catalog.find((d) => d.id === req.params.id);
    if (!source) throw fail(404, "Collection not found.");
    const existing = db
      .prepare("SELECT id FROM decks WHERE user_id=? AND source=?")
      .get(req.user.id, source.id);
    const id =
      existing?.id ||
      insertDeck(
        req.user.id,
        {
          ...source,
          cards: source.cards.map(([front, back]) => ({ front, back })),
        },
        source.id,
      );
    res.json(deckFor(req.user.id, id));
  });
  app.put("/api/decks/:id", auth, (req, res) => {
    const data = deckSchema.parse(req.body);
    db.transaction(() => {
      const original = deckFor(req.user.id, req.params.id);
      const oldIds = new Set(original.cards.map((c) => c.id));
      const seen = new Set();
      for (const c of data.cards) {
        if (c.id && (!oldIds.has(c.id) || seen.has(c.id)))
          throw fail(400, "Invalid card reference.");
        if (c.id) seen.add(c.id);
      }
      db.prepare(
        "UPDATE decks SET title=?,description=?,category=?,color=? WHERE id=?",
      ).run(
        data.title,
        data.description,
        data.category,
        data.color,
        original.id,
      );
      for (const c of data.cards) {
        if (c.id)
          db.prepare("UPDATE cards SET front=?,back=? WHERE id=?").run(
            c.front,
            c.back,
            c.id,
          );
        else
          db.prepare(
            "INSERT INTO cards (id,deck_id,front,back,due) VALUES (?,?,?,?,?)",
          ).run(randomUUID(), original.id, c.front, c.back, Date.now());
      }
      for (const id of oldIds)
        if (!seen.has(id)) db.prepare("DELETE FROM cards WHERE id=?").run(id);
    })();
    res.json(deckFor(req.user.id, req.params.id));
  });
  app.delete("/api/decks/:id", auth, (req, res) => {
    deckFor(req.user.id, req.params.id);
    db.prepare("DELETE FROM decks WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });
  app.post("/api/reviews", auth, (req, res) => {
    const data = z
      .object({
        cardId: z.uuid(),
        rating: z.enum(["again", "hard", "good", "easy"]),
        requestId: z.uuid(),
      })
      .parse(req.body);
    db.transaction(() => {
      const previous = db
        .prepare("SELECT * FROM reviews WHERE id=?")
        .get(data.requestId);
      if (previous) {
        if (
          previous.user_id !== req.user.id ||
          previous.card_id !== data.cardId ||
          previous.rating !== data.rating
        )
          throw fail(409, "Review identifier is already in use.");
        return;
      }
      const card = db
        .prepare(
          "SELECT c.* FROM cards c JOIN decks d ON c.deck_id=d.id WHERE c.id=? AND d.user_id=?",
        )
        .get(data.cardId, req.user.id);
      if (!card) throw fail(404, "Card not found.");
      if (card.due > Date.now()) throw fail(409, "This card is not due yet.");
      const next = schedule(card, data.rating);
      db.prepare(
        "UPDATE cards SET interval=?,ease=?,repetitions=?,due=? WHERE id=?",
      ).run(next.interval, next.ease, next.repetitions, next.due, card.id);
      db.prepare("INSERT INTO reviews VALUES (?,?,?,?,?)").run(
        data.requestId,
        req.user.id,
        card.id,
        data.rating,
        Date.now(),
      );
    })();
    res.json({ ok: true });
  });
  app.get("/api/progress", auth, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT rating,created FROM reviews WHERE user_id=? ORDER BY created",
        )
        .all(req.user.id),
    ),
  );
  app.get("/api/export", auth, (req, res) =>
    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: publicUser(req.user),
      decks: db
        .prepare("SELECT id FROM decks WHERE user_id=?")
        .all(req.user.id)
        .map((d) => deckFor(req.user.id, d.id)),
      reviews: db
        .prepare("SELECT rating,created FROM reviews WHERE user_id=?")
        .all(req.user.id),
    }),
  );
  app.delete("/api/me", authLimit, auth, async (req, res) => {
    const { password } = z
      .object({ password: z.string().max(128) })
      .parse(req.body);
    if (!(await checkPassword(password, req.user.password)))
      throw fail(403, "Password is incorrect.");
    if (config.cloudUrl) await cloud(req.user, "/v1/account/delete", {});
    db.prepare("DELETE FROM users WHERE id=?").run(req.user.id);
    res.clearCookie("memify_session", cookieOptions).json({ ok: true });
  });
  async function cloud(user, path, payload) {
    if (!config.cloudUrl || !config.cloudSecret)
      throw fail(
        503,
        "Memify Cloud is not connected on this installation. You can still create and study your own decks.",
      );
    const body = JSON.stringify({
      ...payload,
      userId: user.id,
      verified: Boolean(user.verified),
    });
    let response;
    try {
      response = await fetcher(`${config.cloudUrl}${path}`, {
        method: "POST",
        headers: signedHeaders(config.cloudSecret, path, body),
        body,
        signal: AbortSignal.timeout(95000),
      });
    } catch {
      throw fail(
        503,
        "The generation service is temporarily unavailable. Please retry.",
      );
    }
    const result = await response.json();
    if (!response.ok)
      throw fail(response.status, result.error || "Cloud request failed.");
    return result;
  }
  app.get("/api/credits", auth, async (req, res) => {
    if (!config.cloudUrl)
      return res.json({ connected: false, balance: 0, packs: [] });
    res.json({
      connected: true,
      ...(await cloud(req.user, "/v1/credits", {})),
    });
  });
  app.get("/api/generations", auth, async (req, res) => {
    if (!config.cloudUrl) return res.json([]);
    res.json(await cloud(req.user, "/v1/generations", {}));
  });
  app.post("/api/generate", auth, async (req, res) => {
    if (!req.user.verified)
      throw fail(403, "Verify your email in Settings to unlock generation.");
    res.json(
      await cloud(req.user, "/v1/generate", generationSchema.parse(req.body)),
    );
  });
  app.post("/api/checkout", auth, async (req, res) => {
    if (!req.user.verified)
      throw fail(403, "Verify your email before purchasing credits.");
    const data = z
      .object({ pack: z.enum(["small", "large"]), requestId: z.uuid() })
      .parse(req.body);
    res.json(await cloud(req.user, "/v1/checkout", data));
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  const dist = resolve("dist");
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false }));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve(dist, "index.html")),
    );
  }
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return res
        .status(400)
        .json({ error: error.issues[0]?.message || "Check your input." });
    const status =
      error.status || (error.type === "entity.too.large" ? 413 : 500);
    if (status >= 500) console.error("Request failed:", error.message);
    res.status(status).json({
      error:
        status === 500
          ? "Something went wrong. Please try again."
          : error.message,
    });
  });
  return app;
}
