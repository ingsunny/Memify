import { createApp } from "./app.js";
import { openDatabase } from "./db.js";
const env = process.env;
const config = {
  production: env.NODE_ENV === "production",
  appOrigin: env.APP_ORIGIN || "http://localhost:5173",
  cloudUrl: env.CLOUD_URL || "",
  cloudSecret: env.CLOUD_SHARED_SECRET || "",
  trustProxy: env.TRUST_PROXY === "1",
  // Cloudinary. The secret signs uploads server-side and is never sent
  // to the browser; the cloud name and key are public by design.
  cloudinaryName: env.CLOUDINARY_CLOUD_NAME,
  cloudinaryKey: env.CLOUDINARY_API_KEY,
  cloudinarySecret: env.CLOUDINARY_API_SECRET,
  smtpHost: env.SMTP_HOST,
  smtpPort: Number(env.SMTP_PORT || 587),
  smtpUser: env.SMTP_USER,
  smtpPassword: env.SMTP_PASSWORD,
  mailFrom: env.MAIL_FROM || "Memify <hello@localhost>",
};
if (
  config.production &&
  (!config.appOrigin.startsWith("https://") ||
    !config.smtpHost ||
    !env.MAIL_FROM)
)
  throw new Error(
    "Production requires HTTPS APP_ORIGIN, SMTP_HOST, and MAIL_FROM.",
  );
if (config.cloudUrl && config.cloudSecret.length < 32)
  throw new Error("CLOUD_SHARED_SECRET must contain at least 32 characters.");
const db = openDatabase(env.DATABASE_PATH || "data/memify.db");
const server = createApp({ db, config }).listen(
  Number(env.PORT || 3001),
  env.HOST || "127.0.0.1",
  () => console.info(`Memify API listening on port ${env.PORT || 3001}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
