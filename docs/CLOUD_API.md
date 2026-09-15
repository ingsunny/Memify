# Optional cloud protocol v1

Memify’s server calls `CLOUD_URL` using POST JSON. All requests include `userId` (UUID) and `verified` (boolean), sourced from the authenticated server session. Clients cannot override them.

Headers:

- `x-memify-timestamp`: Unix milliseconds, valid within 60 seconds.
- `x-memify-nonce`: a new UUID for every HTTP attempt.
- `x-memify-signature`: lowercase hex HMAC-SHA256.

The signed message is exactly `timestamp + "\n" + nonce + "\nPOST\n" + path + "\n" + rawJsonBody`, with the shared secret as key. The service must reject reused nonces. Use TLS when crossing a host boundary. Possession of this secret grants authority to assert account identities: never distribute the hosted service secret to self-hosters.

| Path                 | Additional input                                                           | Output                                                            |
| -------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `/v1/credits`        | none                                                                       | `balance`, `generationReady`, `paymentsReady`, `packs`, `history` |
| `/v1/generations`    | none                                                                       | Last 20 generation records: `id`, `status`, `created`, `result`   |
| `/v1/generate`       | `requestId`, `topic`, `level`, `objective`, `description`, `count`, `mode` | `requestId`, `title`, `description`, `cards: [{front,back}]`      |
| `/v1/checkout`       | `requestId`, `pack` (`small` or `large`)                                   | `url`                                                             |
| `/v1/account/delete` | none                                                                       | `ok`                                                              |

`level`: beginner/intermediate/advanced. `mode`: flashcards/quiz. `count`: 1–20. `description`: 1–12,000 characters. Generation and checkout request IDs must be UUIDs. Persist a generation request ID across uncertain network retries; create a new ID when parameters change or a known failed/refunded request is restarted. The backend enforces credit limits, not the frontend.

Errors are `{ "error": "Readable explanation" }` with HTTP status. A successful generation costs one credit, independent of count. Failed generation restores the reservation. Existing completed requests return the original result. A 409 can indicate pending work or an ID conflict; read its explanation.

`/api/credits` adds `connected` for the UI. Unconnected self-hosted installations return `connected:false` and remain fully usable for manual learning.
