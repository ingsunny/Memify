# Release checklist

Automated local checks do not exercise externally provisioned accounts. These are the remaining operator acceptance checks for a public paid launch:

- [ ] Set domain, HTTPS, SMTP sending identity, and production environment. Test real verification and reset delivery.
- [ ] Connect cloud over a private network or HTTPS with a strong shared secret.
- [ ] Select and configure an available Gemini model; verify actual generated content, latency, and cost for 1–20 cards and long notes.
- [ ] Configure Stripe; verify test-mode checkout, delayed payment, cancellation, duplicate webhook delivery and credit fulfillment. Check real merchant eligibility, currency and tax handling before live mode.
- [ ] Document the operator’s privacy notice, terms, contact channel and refund policy before collecting public users’ data. Cloud generation transmits submitted notes to Google; Stripe processes purchases. Financial records are retained separately from deleted learning content.
- [ ] Set up health/error alerts and encrypted off-host backups. Restore both databases in an isolated environment.
- [ ] Confirm a single process per database, trusted-proxy settings, TLS, secrets, service restarts and disk capacity.
- [ ] Review and approve the published branding and AGPL/proprietary boundary.

Implemented safeguards include server-side identity and ownership checks, transactional review scheduling, credit reservations, verified payment signatures, duplicate checkout protection, rate limits, and startup refund recovery. These do not replace live acceptance checks or ongoing operations.
