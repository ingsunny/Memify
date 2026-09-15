# Security

Do not put credentials, personal data, or exploit details in a public issue. Use GitHub’s private vulnerability reporting if enabled for this repository; otherwise contact the repository owner privately through their published contact channel before disclosing details.

Keep Node and locked dependencies updated, use HTTPS in production, configure the exact APP_ORIGIN, and keep database files and environment files outside public assets. Only expose the public app through a trusted proxy. Do not enable proxy trust for untrusted clients.

The current deployment supports one process per SQLite database. Horizontal scaling requires a shared rate limiter and transactional database/worker changes.
