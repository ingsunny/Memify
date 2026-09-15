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
