# Deployment

## Single-server release

1. Install Node.js 22.13+ and run `npm ci && npm run check`.
2. Create a private `.env` with `NODE_ENV=production`, `APP_ORIGIN=https://your-domain`, SMTP credentials and `MAIL_FROM`. Use a verified sending domain. Configure cloud URL/secret only if using that service.
3. Persist the directory containing `DATABASE_PATH`. Run `npm start` as an unprivileged service user. The default bind address is loopback; put Caddy or nginx in front for HTTPS.
4. Configure the reverse proxy to forward all paths, including `/api`, to port 3001 and allow at least 100 seconds for generation responses. Set `TRUST_PROXY=1` only when exactly one trusted proxy overwrites forwarding headers. Block direct public access to API and cloud ports.
5. Check `/api/health`, account verification, password reset, and data export from the real browser origin. A wrong APP_ORIGIN will deliberately reject writes.

Docker is optional: `docker build -t memify .`. Mount a writable `/app/data` volume owned by UID 1000, pass the environment, and expose container port 3001 only to the reverse proxy. The Dockerfile binds to 0.0.0.0 inside the container.

## Backups and updates

Use SQLite’s online backup API rather than copying an active database file without its WAL. From the repository:

```sh
node --input-type=module -e 'import Database from "better-sqlite3"; const db = new Database(process.env.DATABASE_PATH || "data/memify.db"); await db.backup("data/backup.db"); db.close();'
```

Encrypt and copy the snapshot off-host, with retention appropriate to your users. Exercise restoration into a separate instance before launch. Do the equivalent separately for the cloud ledger. Back up both before schema changes; the current migration is recorded in the `migrations` table. Future schema changes must use numbered, transactional migrations rather than editing already-applied table definitions.

A restore replaces the database only while its service is stopped. Never restore the live credit ledger to an older snapshot without reconciling successful payment events against Stripe.

## Operations

Monitor both health endpoints, HTTP errors, provider latency, email failures, disk space, and backup age using your hosting platform. Logs intentionally omit bodies, passwords, and provider keys. Development-only mail logs contain action tokens: never run that mode with real users. Rotate the shared service secret on both services together.
