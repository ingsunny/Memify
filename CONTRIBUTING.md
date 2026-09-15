# Contributing

Welcome, curious mind.

1. Fork and clone this repository. Run `npm ci`, then `npm run dev`.
2. Keep changes focused and explain the user-facing problem in your PR.
3. Run `npm run check`. For UI/workflow changes, also run `npm run test:e2e` after building.
4. Include screenshots for visual changes and relevant test results. Never commit `.env`, databases, user exports, or private cloud code.

Use TypeScript for UI, standard ES modules for server code, semantic HTML, and plain-text card rendering. Keep credentials and authorization on the server. Preserve user data in migrations. New contributors should be able to run the public learning app without the proprietary cloud service.

Contributions are accepted under this repository’s AGPL-3.0 license. Be considerate, specific, and constructive in discussions. Accessibility and clear errors are part of the feature, not follow-up work.
