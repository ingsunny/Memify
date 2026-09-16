import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../server/db.js";
import { createApp } from "../server/app.js";
import { schedule } from "../server/scheduler.js";
let server, base;
const db = openDatabase(":memory:");
const emails = [];
const origin = "http://localhost:5173";
before(async () => {
  server = createApp({
    db,
    config: { appOrigin: origin, test: true },
    mailer: async (email, kind, link) => {
      emails.push({ email, kind, link });
    },
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  db.close();
});
async function request(
  path,
  body,
  cookie,
  method = body ? "POST" : "GET",
  customOrigin = origin,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      origin: customOrigin,
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    body: await response.json(),
  };
}
const profile = (email) => ({
  name: "Sunny",
  email,
  password: "a-long-test-password",
  goal: 10,
  topic: "Science",
  level: "Curious beginner",
});
test("signup, case-insensitive login, origin protection, ownership, review idempotency, password reset", async () => {
  assert.equal(
    (
      await request(
        "/auth/signup",
        profile("first@example.com"),
        null,
        "POST",
        "https://evil.example",
      )
    ).status,
    403,
  );
  const first = await request("/auth/signup", profile("first@example.com"));
  assert.equal(first.status, 201);
  assert.equal(first.body.user.verified, false);
  const cookie = first.cookie;
  assert.equal(
    (await request("/auth/signup", profile("FIRST@example.com"))).status,
    409,
  );
  assert.equal(
    (
      await request("/auth/login", {
        email: "FIRST@example.com",
        password: "a-long-test-password",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/auth/login", {
        email: "first@example.com",
        password: "wrong",
      })
    ).status,
    401,
  );
  assert.equal((await request("/decks")).status, 401);
  const other = await request("/auth/signup", profile("other@example.com"));
  const decks = (await request("/decks", null, cookie)).body;
  assert.equal(decks.length, 1);
  assert.equal(decks[0].cards.length, 8);
  const deck = decks[0];
  assert.equal(
    (await request(`/decks/${deck.id}`, {}, other.cookie, "DELETE")).status,
    404,
  );
  const review = {
    cardId: deck.cards[0].id,
    rating: "good",
    requestId: randomUUID(),
  };
  assert.equal((await request("/reviews", review, other.cookie)).status, 404);
  assert.equal((await request("/reviews", review, cookie)).status, 200);
  assert.equal((await request("/reviews", review, cookie)).status, 200);
  assert.equal((await request("/progress", null, cookie)).body.length, 1);
  assert.equal(
    (await request("/reviews", { ...review, requestId: randomUUID() }, cookie))
      .status,
    409,
  );
  const update = {
    title: "Updated",
    cards: [{ ...deck.cards[0], front: "Updated question" }],
  };
  assert.equal(
    (await request(`/decks/${deck.id}`, update, cookie, "PUT")).status,
    200,
  );
  const edited = (await request("/decks", null, cookie)).body[0];
  assert.equal(edited.cards[0].repetitions, 1);
  assert.equal(edited.cards.length, 1);
  const token = new URLSearchParams(
    new URL(
      emails.find((e) => e.email === "first@example.com" && e.kind === "verify")
        .link,
    ).hash.slice(1),
  ).get("token");
  assert.equal((await request("/auth/verify", { token })).status, 200);
  assert.equal((await request("/auth/verify", { token })).status, 400);
  assert.equal((await request("/me", null, cookie)).body.user.verified, true);
  assert.equal((await request("/credits", null, cookie)).body.connected, false);
  await request("/auth/forgot", { email: "first@example.com" });
  const resetToken = new URLSearchParams(
    new URL(emails.find((e) => e.kind === "reset").link).hash.slice(1),
  ).get("token");
  assert.equal(
    (
      await request("/auth/reset", {
        token: resetToken,
        password: "another-long-password",
      })
    ).status,
    200,
  );
  assert.equal((await request("/me", null, cookie)).body.user, null);
  assert.equal(
    (
      await request("/auth/reset", {
        token: resetToken,
        password: "another-long-password",
      })
    ).status,
    400,
  );
  const login = await request("/auth/login", {
    email: "first@example.com",
    password: "another-long-password",
  });
  assert.equal(login.status, 200);
  assert.equal(
    (await request("/export", null, login.cookie)).body.decks.length,
    1,
  );
  assert.equal(
    (await request("/me", { password: "wrong" }, login.cookie, "DELETE"))
      .status,
    403,
  );
  assert.equal(
    (
      await request(
        "/me",
        { password: "another-long-password" },
        login.cookie,
        "DELETE",
      )
    ).status,
    200,
  );
  assert.equal((await request("/me", null, login.cookie)).body.user, null);
  assert.equal(
    db
      .prepare("SELECT count(*) AS n FROM decks WHERE user_id=?")
      .get(first.body.user.id).n,
    0,
  );
});
test("deck edits reject foreign card IDs and roll back metadata", async () => {
  const u = await request("/auth/signup", profile("cards@example.com"));
  const deck = (await request("/decks", null, u.cookie)).body[0];
  assert.equal(
    (
      await request(
        `/decks/${deck.id}`,
        {
          title: "Should not persist",
          cards: [{ id: randomUUID(), front: "x", back: "y" }],
        },
        u.cookie,
        "PUT",
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("/decks", null, u.cookie)).body[0].title,
    deck.title,
  );
});
test("review scheduling handles forgetting, progression and ease bounds", () => {
  assert.deepEqual(schedule({}, "good", 0), {
    interval: 1,
    ease: 2.5,
    repetitions: 1,
    due: 86400000,
  });
  assert.equal(
    schedule({ repetitions: 1, interval: 1 }, "good", 0).interval,
    6,
  );
  assert.equal(
    schedule({ ease: 1.3, repetitions: 5, interval: 20 }, "again", 0).due,
    60000,
  );
  assert.equal(schedule({ ease: 1.3 }, "hard").ease, 1.3);
  assert.equal(schedule({ ease: 3.5 }, "easy").ease, 3.5);
  assert.throws(() => schedule({}, "invalid"));
});

test("shared library ranks, votes once per user, and saves into a library", async () => {
  const a = await request("/auth/signup", profile("voter-a@example.com"));
  const b = await request("/auth/signup", profile("voter-b@example.com"));
  const listing = await request("/shared?sort=top");
  assert.equal(listing.status, 200);
  assert.ok(listing.body.decks.length > 10, "seeded decks are listed");
  assert.ok(listing.body.categories.length > 1, "categories are grouped");
  // Top sort is descending by votes.
  const votes = listing.body.decks.map((d) => d.votes);
  assert.deepEqual(
    votes,
    [...votes].sort((x, y) => y - x),
  );

  const target = listing.body.decks[0];
  const first = await request(`/shared/${target.id}/vote`, {}, a.cookie);
  assert.equal(first.body.voted, true);
  assert.equal(first.body.votes, target.votes + 1);
  // Voting again from the same account retracts rather than stacking.
  const again = await request(`/shared/${target.id}/vote`, {}, a.cookie);
  assert.equal(again.body.voted, false);
  assert.equal(again.body.votes, target.votes);
  // A different account contributes its own vote.
  const other = await request(`/shared/${target.id}/vote`, {}, b.cookie);
  assert.equal(other.body.votes, target.votes + 1);

  const saved = await request(`/shared/${target.id}/save`, {}, a.cookie);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.title, target.title);
  assert.ok(saved.body.cards.length > 0, "cards come across on save");
  // Saving twice reuses the same deck instead of duplicating it.
  const resaved = await request(`/shared/${target.id}/save`, {}, a.cookie);
  assert.equal(resaved.body.id, saved.body.id);

  // Anonymous users can read but not vote.
  assert.equal((await request(`/shared/${target.id}/vote`, {})).status, 401);
});

test("free plan limits publishing, deck count and note tabs", async () => {
  const user = await request("/auth/signup", profile("limits@example.com"));
  const me = await request("/me", null, user.cookie);
  assert.equal(me.body.plan.pro, false);
  assert.equal(me.body.plan.limits.noteTabs, 1);
  assert.equal(me.body.plan.limits.maxCardsPerGeneration, 20);

  // Publishing is a paid capability.
  const deck = await request(
    "/decks",
    { title: "Mine", cards: [{ front: "a", back: "b" }] },
    user.cookie,
  );
  const published = await request(
    "/shared",
    { deckId: deck.body.id },
    user.cookie,
  );
  assert.equal(published.status, 402);
  assert.match(published.body.error, /Pro/);

  // One note on the free plan; a second is refused.
  const note = await request("/notes", { title: "n", body: "" }, user.cookie);
  assert.equal(note.status, 201);
  const second = await request("/notes", { title: "m", body: "" }, user.cookie);
  assert.equal(second.status, 402);

  // Notes are private to their owner.
  const stranger = await request("/auth/signup", profile("nosy@example.com"));
  const theirs = await request("/notes", null, stranger.cookie);
  assert.deepEqual(theirs.body, []);
  assert.equal(
    (
      await request(
        `/notes/${note.body.id}`,
        { title: "hacked", body: "x" },
        stranger.cookie,
        "PUT",
      )
    ).status,
    404,
  );

  // The deck ceiling is enforced (free plan holds 6).
  for (let i = 0; i < 8; i++)
    await request(
      "/decks",
      { title: `Deck ${i}`, cards: [{ front: "a", back: "b" }] },
      user.cookie,
    );
  const overflow = await request(
    "/decks",
    { title: "Too many", cards: [{ front: "a", back: "b" }] },
    user.cookie,
  );
  assert.equal(overflow.status, 402);
});

test("workspace layout round-trips and rejects oversized state", async () => {
  const user = await request("/auth/signup", profile("layout@example.com"));
  assert.deepEqual((await request("/workspace", null, user.cookie)).body, {});
  const state = { notes: { x: 10, y: 20, w: 340, h: 380, open: true } };
  assert.equal(
    (await request("/workspace", { state }, user.cookie, "PUT")).status,
    200,
  );
  assert.deepEqual(
    (await request("/workspace", null, user.cookie)).body,
    state,
  );
  const huge = { blob: "x".repeat(9000) };
  assert.equal(
    (await request("/workspace", { state: huge }, user.cookie, "PUT")).status,
    413,
  );
});

test("workspace stores placement only, never whether a tool was open", async () => {
  const user = await request("/auth/signup", profile("tools@example.com"));
  // The client must not persist an open flag: a tool window is an
  // explicit action and must never reappear on its own after a refresh.
  const state = { notes: { x: 120, y: 80, w: 340, h: 380 } };
  await request("/workspace", { state }, user.cookie, "PUT");
  const saved = (await request("/workspace", null, user.cookie)).body;
  assert.deepEqual(saved, state);
  for (const panel of Object.values(saved))
    assert.ok(
      !("open" in panel),
      "geometry must not carry an open flag back to the client",
    );
});

test("deck appearance persists, rejects foreign banners, and publish toggles both ways", async () => {
  const user = await request("/auth/signup", profile("looks@example.com"));
  db.prepare(
    "INSERT INTO subscriptions (user_id,plan,status,renews,reference,updated) VALUES (?,?,?,?,?,?)",
  ).run(
    (await request("/me", null, user.cookie)).body.user.id,
    "yearly",
    "active",
    Date.now() + 86400000,
    "test",
    Date.now(),
  );
  const created = await request(
    "/decks",
    {
      title: "Looks",
      category: "Personal",
      color: "sage",
      accent: "#7c3aed",
      icon: "FlaskConical",
      banner:
        "https://res.cloudinary.com/dqmr455zn/image/upload/v1/memify/a.png",
      cards: [{ front: "a", back: "b" }],
    },
    user.cookie,
  );
  assert.equal(created.status, 201);
  assert.equal(created.body.accent, "#7c3aed");
  assert.equal(created.body.icon, "FlaskConical");
  assert.equal(created.body.published, false, "decks are private by default");

  // A banner may only point at our own Cloudinary account, so a deck
  // cannot be used to embed arbitrary remote content.
  const foreign = await request(
    "/decks",
    {
      title: "Bad",
      category: "P",
      color: "sage",
      banner: "https://evil.example.com/x.png",
      cards: [{ front: "a", back: "b" }],
    },
    user.cookie,
  );
  assert.equal(foreign.status, 400);

  const published = await request(
    `/decks/${created.body.id}/publish`,
    { publish: true },
    user.cookie,
  );
  assert.equal(published.body.published, true);
  assert.equal(published.body.votes, 0);
  assert.ok(
    (await request("/shared")).body.decks.some((d) => d.title === "Looks"),
    "a published deck appears in the shared library",
  );

  const retracted = await request(
    `/decks/${created.body.id}/publish`,
    { publish: false },
    user.cookie,
  );
  assert.equal(retracted.body.published, false);
  assert.ok(
    !(await request("/shared")).body.decks.some((d) => d.title === "Looks"),
    "retracting removes it from the library again",
  );
});

test("handled generations drop out of the recent list", async () => {
  const user = await request("/auth/signup", profile("gens@example.com"));
  const id = randomUUID();
  assert.equal(
    (
      await request(
        `/generations/${id}/dismiss`,
        { state: "saved" },
        user.cookie,
      )
    ).status,
    200,
  );
  // Dismissals are per account, so one user cannot hide another's work.
  const other = await request("/auth/signup", profile("gens2@example.com"));
  const rows = db
    .prepare("SELECT user_id FROM generation_state WHERE request_id=?")
    .all(id);
  assert.equal(rows.length, 1);
  assert.notEqual(
    rows[0].user_id,
    (await request("/me", null, other.cookie)).body.user.id,
  );
});
