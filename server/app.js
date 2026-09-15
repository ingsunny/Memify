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
import { entitlements, isPro, plans, publicPlans } from "./plans.js";
import { seedSharedDecks } from "./seed.js";

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
const noteSchema = z.object({
  title: z.string().trim().max(60).default("Untitled"),
  body: z.string().max(20000).default(""),
});
const shareSchema = z.object({ deckId: z.uuid() });
const workspaceSchema = z.object({
  state: z.record(z.string(), z.unknown()),
});
const generationSchema = z.object({
  topic: text(150),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  objective: text(250),
  description: text(12000),
  count: z.number().int().min(1).max(100),
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
  seedSharedDecks(db);
  const subFor = (userId) =>
    db.prepare("SELECT * FROM subscriptions WHERE user_id=?").get(userId) ||
    null;
  const planState = (userId) => {
    const subscription = subFor(userId);
    const pro = isPro(subscription);
    const limits = entitlements(subscription);
    const used = db
      .prepare(
        "SELECT count(*) AS n FROM generations_local WHERE user_id=? AND created>?",
      )
      .get(userId, Date.now() - 30 * 86400000)?.n;
    return {
      pro,
      plan: subscription?.plan || "free",
      status: subscription?.status || "active",
      renews: subscription?.renews || null,
      limits: {
        ...limits,
        decks: limits.decks === Infinity ? null : limits.decks,
        generationsPerMonth:
          limits.generationsPerMonth === Infinity
            ? null
            : limits.generationsPerMonth,
        tracks: limits.tracks === Infinity ? null : limits.tracks,
      },
      generationsUsed: used || 0,
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
    res.json({
      user: req.user ? publicUser(req.user) : null,
      plan: req.user ? planState(req.user.id) : null,
    }),
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
    const limits = entitlements(subFor(req.user.id));
    const owned = db
      .prepare("SELECT count(*) AS n FROM decks WHERE user_id=?")
      .get(req.user.id).n;
    if (owned >= limits.decks)
      throw fail(
        402,
        `The free plan holds ${limits.decks} decks. Upgrade for unlimited decks.`,
      );
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
    const input = generationSchema.parse(req.body);
    const limits = entitlements(subFor(req.user.id));
    if (input.count > limits.maxCardsPerGeneration)
      throw fail(
        402,
        `The free plan generates up to ${limits.maxCardsPerGeneration} cards at a time. Memify Pro goes to 100.`,
      );
    const used = db
      .prepare(
        "SELECT count(*) AS n FROM generations_local WHERE user_id=? AND created>?",
      )
      .get(req.user.id, Date.now() - 30 * 86400000).n;
    if (used >= limits.generationsPerMonth)
      throw fail(
        402,
        "You have used this month's free generations. Upgrade for unlimited AI sets.",
      );
    const result = await cloud(req.user, "/v1/generate", input);
    // Record only on success so a failed generation never burns quota.
    db.prepare(
      "INSERT OR IGNORE INTO generations_local (id,user_id,cards,created) VALUES (?,?,?,?)",
    ).run(input.requestId, req.user.id, input.count, Date.now());
    res.json(result);
  });
  app.post("/api/checkout", auth, async (req, res) => {
    if (!req.user.verified)
      throw fail(403, "Verify your email before purchasing credits.");
    const data = z
      .object({ pack: z.enum(["small", "large"]), requestId: z.uuid() })
      .parse(req.body);
    res.json(await cloud(req.user, "/v1/checkout", data));
  });
  // ---- Shared deck library -------------------------------------------
  const sharedRow = (row, votedIds) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    color: row.color,
    author: row.author,
    cardCount: row.card_count,
    votes: row.votes,
    saves: row.saves,
    created: row.created,
    mine: Boolean(row.user_id && row.user_id === row.viewer_id),
    voted: votedIds.has(row.id),
  });
  app.get("/api/shared", (req, res) => {
    const query = z
      .object({
        category: z.string().trim().max(50).optional(),
        sort: z.enum(["top", "new", "trending"]).default("top"),
        search: z.string().trim().max(80).optional(),
      })
      .parse(req.query);
    const where = [];
    const params = [];
    if (query.category && query.category !== "All") {
      where.push("category=?");
      params.push(query.category);
    }
    if (query.search) {
      where.push("(title LIKE ? OR description LIKE ?)");
      params.push(`%${query.search}%`, `%${query.search}%`);
    }
    // Trending balances votes against age so a strong new deck can still
    // surface above an older one that has simply accumulated votes.
    const order =
      query.sort === "new"
        ? "created DESC"
        : query.sort === "trending"
          ? "(CAST(votes AS REAL) / (((? - created) / 3600000.0) + 2)) DESC"
          : "votes DESC, created DESC";
    const orderParams = query.sort === "trending" ? [Date.now()] : [];
    const rows = db
      .prepare(
        `SELECT * FROM shared_decks ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${order} LIMIT 60`,
      )
      .all(...params, ...orderParams);
    const voted = new Set(
      req.user
        ? db
            .prepare("SELECT shared_id FROM shared_votes WHERE user_id=?")
            .all(req.user.id)
            .map((v) => v.shared_id)
        : [],
    );
    res.json({
      categories: db
        .prepare(
          "SELECT category, count(*) AS n FROM shared_decks GROUP BY category ORDER BY n DESC",
        )
        .all(),
      decks: rows.map((r) =>
        sharedRow({ ...r, viewer_id: req.user?.id }, voted),
      ),
    });
  });
  app.get("/api/shared/:id", (req, res) => {
    const row = db
      .prepare("SELECT * FROM shared_decks WHERE id=?")
      .get(req.params.id);
    if (!row) throw fail(404, "This collection is no longer available.");
    const voted = new Set(
      req.user
        ? db
            .prepare(
              "SELECT shared_id FROM shared_votes WHERE user_id=? AND shared_id=?",
            )
            .all(req.user.id, row.id)
            .map((v) => v.shared_id)
        : [],
    );
    res.json({
      ...sharedRow({ ...row, viewer_id: req.user?.id }, voted),
      cards: JSON.parse(row.cards),
    });
  });
  app.post("/api/shared/:id/vote", auth, (req, res) => {
    const row = db
      .prepare("SELECT * FROM shared_decks WHERE id=?")
      .get(req.params.id);
    if (!row) throw fail(404, "This collection is no longer available.");
    const votes = db.transaction(() => {
      const existing = db
        .prepare("SELECT 1 FROM shared_votes WHERE shared_id=? AND user_id=?")
        .get(row.id, req.user.id);
      if (existing) {
        db.prepare(
          "DELETE FROM shared_votes WHERE shared_id=? AND user_id=?",
        ).run(row.id, req.user.id);
        db.prepare(
          "UPDATE shared_decks SET votes=MAX(0,votes-1) WHERE id=?",
        ).run(row.id);
        return false;
      }
      db.prepare("INSERT INTO shared_votes VALUES (?,?,?)").run(
        row.id,
        req.user.id,
        Date.now(),
      );
      db.prepare("UPDATE shared_decks SET votes=votes+1 WHERE id=?").run(
        row.id,
      );
      return true;
    })();
    const fresh = db
      .prepare("SELECT votes FROM shared_decks WHERE id=?")
      .get(row.id);
    res.json({ voted: votes, votes: fresh.votes });
  });
  app.post("/api/shared", auth, (req, res) => {
    const limits = entitlements(subFor(req.user.id));
    if (!limits.publish)
      throw fail(
        402,
        "Publishing to the library is part of Memify Pro. Upgrade to share your decks.",
      );
    const { deckId } = shareSchema.parse(req.body);
    const deck = deckFor(req.user.id, deckId);
    const existing = db
      .prepare("SELECT id FROM shared_decks WHERE deck_id=? AND user_id=?")
      .get(deck.id, req.user.id);
    if (existing) throw fail(409, "This deck is already in the library.");
    const id = randomUUID();
    db.prepare(
      "INSERT INTO shared_decks (id,deck_id,user_id,author,title,description,category,color,cards,card_count,votes,saves,seeded,created) VALUES (?,?,?,?,?,?,?,?,?,?,0,0,0,?)",
    ).run(
      id,
      deck.id,
      req.user.id,
      req.user.name,
      deck.title,
      deck.description,
      deck.category,
      deck.color,
      JSON.stringify(deck.cards.map((c) => ({ front: c.front, back: c.back }))),
      deck.cards.length,
      Date.now(),
    );
    res.status(201).json({ id });
  });
  app.delete("/api/shared/:id", auth, (req, res) => {
    const row = db
      .prepare("SELECT * FROM shared_decks WHERE id=? AND user_id=?")
      .get(req.params.id, req.user.id);
    if (!row) throw fail(404, "Collection not found.");
    db.prepare("DELETE FROM shared_decks WHERE id=?").run(row.id);
    res.json({ ok: true });
  });
  app.post("/api/shared/:id/save", auth, (req, res) => {
    const row = db
      .prepare("SELECT * FROM shared_decks WHERE id=?")
      .get(req.params.id);
    if (!row) throw fail(404, "This collection is no longer available.");
    const limits = entitlements(subFor(req.user.id));
    const owned = db
      .prepare("SELECT count(*) AS n FROM decks WHERE user_id=?")
      .get(req.user.id).n;
    if (owned >= limits.decks)
      throw fail(
        402,
        `The free plan holds ${limits.decks} decks. Upgrade to keep adding.`,
      );
    const existing = db
      .prepare("SELECT id FROM decks WHERE user_id=? AND source=?")
      .get(req.user.id, `shared:${row.id}`);
    const id =
      existing?.id ||
      insertDeck(
        req.user.id,
        {
          title: row.title,
          description: row.description,
          category: row.category,
          color: row.color,
          cards: JSON.parse(row.cards),
        },
        `shared:${row.id}`,
      );
    if (!existing)
      db.prepare("UPDATE shared_decks SET saves=saves+1 WHERE id=?").run(
        row.id,
      );
    res.json(deckFor(req.user.id, id));
  });

  // ---- Notepad ---------------------------------------------------------
  app.get("/api/notes", auth, (req, res) =>
    res.json(
      db
        .prepare("SELECT * FROM notes WHERE user_id=? ORDER BY position, rowid")
        .all(req.user.id),
    ),
  );
  app.post("/api/notes", auth, (req, res) => {
    const limits = entitlements(subFor(req.user.id));
    const count = db
      .prepare("SELECT count(*) AS n FROM notes WHERE user_id=?")
      .get(req.user.id).n;
    if (count >= limits.noteTabs)
      throw fail(
        402,
        limits.noteTabs === 1
          ? "The free plan keeps one note. Upgrade for three tabs."
          : `Notes are limited to ${limits.noteTabs} tabs.`,
      );
    const data = noteSchema.parse(req.body);
    const id = randomUUID();
    db.prepare(
      "INSERT INTO notes (id,user_id,title,body,position,updated) VALUES (?,?,?,?,?,?)",
    ).run(id, req.user.id, data.title, data.body, count, Date.now());
    res.status(201).json(db.prepare("SELECT * FROM notes WHERE id=?").get(id));
  });
  app.put("/api/notes/:id", auth, (req, res) => {
    const data = noteSchema.parse(req.body);
    const result = db
      .prepare(
        "UPDATE notes SET title=?,body=?,updated=? WHERE id=? AND user_id=?",
      )
      .run(data.title, data.body, Date.now(), req.params.id, req.user.id);
    if (!result.changes) throw fail(404, "Note not found.");
    res.json(db.prepare("SELECT * FROM notes WHERE id=?").get(req.params.id));
  });
  app.delete("/api/notes/:id", auth, (req, res) => {
    const result = db
      .prepare("DELETE FROM notes WHERE id=? AND user_id=?")
      .run(req.params.id, req.user.id);
    if (!result.changes) throw fail(404, "Note not found.");
    res.json({ ok: true });
  });

  // ---- Workspace layout + focus sessions -------------------------------
  app.get("/api/workspace", auth, (req, res) => {
    const row = db
      .prepare("SELECT state FROM workspace WHERE user_id=?")
      .get(req.user.id);
    res.json(row ? JSON.parse(row.state) : {});
  });
  app.put("/api/workspace", auth, (req, res) => {
    const { state } = workspaceSchema.parse(req.body);
    const json = JSON.stringify(state);
    if (json.length > 8000) throw fail(413, "Workspace layout is too large.");
    db.prepare(
      "INSERT INTO workspace (user_id,state,updated) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET state=excluded.state, updated=excluded.updated",
    ).run(req.user.id, json, Date.now());
    res.json({ ok: true });
  });
  app.post("/api/focus", auth, (req, res) => {
    const data = z
      .object({
        minutes: z.number().int().min(1).max(240),
        kind: z.enum(["focus", "break"]).default("focus"),
      })
      .parse(req.body);
    db.prepare("INSERT INTO focus_sessions VALUES (?,?,?,?,?)").run(
      randomUUID(),
      req.user.id,
      data.minutes,
      data.kind,
      Date.now(),
    );
    res.json({ ok: true });
  });
  app.get("/api/focus", auth, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT minutes,kind,created FROM focus_sessions WHERE user_id=? AND created>? ORDER BY created",
        )
        .all(req.user.id, Date.now() - 90 * 86400000),
    ),
  );

  // ---- Subscription ----------------------------------------------------
  app.get("/api/plan", auth, (req, res) =>
    res.json({ ...planState(req.user.id), plans: publicPlans() }),
  );
  app.post("/api/subscribe", auth, async (req, res) => {
    const data = z
      .object({
        plan: z.enum(["monthly", "halfYear", "yearly"]),
        requestId: z.uuid(),
      })
      .parse(req.body);
    if (!req.user.verified)
      throw fail(403, "Verify your email before subscribing.");
    if (!config.cloudUrl)
      throw fail(
        503,
        "Subscriptions are not connected on this installation. Memify stays fully usable without them.",
      );
    const chosen = plans[data.plan];
    res.json(
      await cloud(req.user, "/v1/subscribe", {
        plan: chosen.id,
        rupees: chosen.rupees,
        months: chosen.months,
        requestId: data.requestId,
      }),
    );
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
