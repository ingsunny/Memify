# Architecture

## Learning application

`src/` contains the React UI. `server/` owns sessions, profiles, decks, reviews, and the public starter catalog. Browser requests stay on the same origin; Vite proxies `/api` in development, and Express serves `dist/` in production. React renders card content as plain text, never untrusted HTML.

SQLite runs in WAL mode with foreign keys and a busy timeout. All ownership checks occur on the server. Editing a deck preserves scheduling for retained card IDs and rejects foreign/duplicate IDs before changes. Reviews have client-generated unique IDs; retried submissions do not schedule cards twice. Account deletion cascades local data.

The scheduler is deliberately transparent: initial successful review after one day, next after six days, later intervals multiplied by ease; Again returns after one minute. Practice and quiz sessions do not change the due-card schedule. Ratings are learner self-assessment, not an objective accuracy score. Dashboard dates use the browser’s local timezone. Account history is retained until deletion; large histories will need aggregation/pagination in a later scaling phase.

## Authentication

Passwords use Node scrypt with a random salt. Session and one-time email tokens are cryptographically random; only hashes are stored. Cookies are HTTP-only, SameSite=Lax, and Secure in production. Sessions expire after 30 days; reset/verification links after one hour. A successful reset revokes all sessions. Browser mutations require an exact configured Origin, including signup and login. Rate limits are per process and per IP; run one API process behind one trusted proxy.

Email link tokens live in URL fragments, which are not sent in HTTP requests or referrers. Links require a confirmation action, so email scanners cannot consume them by opening the page.

## Cloud separation

The browser never contacts the proprietary service directly. The learning server signs a versioned JSON request over HTTP using a shared secret. The cloud receives a stable user UUID and verified flag, not the user’s password or email. The public application contains no proprietary generation pipeline or billing logic. A shared API is not itself a guarantee about licensing boundaries; keep both services independently implemented and assess changes that introduce code sharing.

## Deployment boundaries

One learning process and one cloud process, each with its own persistent SQLite volume. No cluster mode, multiwriter replicas, or network filesystems. Cloud recovers pending reservations at startup and therefore must not have overlapping processes on its database. Do not perform rolling deployments with two cloud instances. Move to a transactional server database and durable worker leases before scaling horizontally.
