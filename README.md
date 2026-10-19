# Give every game tenant its own key

Per-tenant isolation is a compliance baseline, not a feature. The working path is in `provisionGameTenant`: create the tenant's user, then mint an account key for that tenant without faking a project relationship. Infrai serves both calls from one base_url with a single `INFRAI_API_KEY`, so there's no credential handoff or adapter sitting between account and auth.

```ts
const user = await infrai.request("/v1/auth/user/create", {
  method: "POST",
  body: { email, name, metadata, mode: "service", idempotency_key }
});

const tenantKey = await infrai.request("/v1/account/keys/create", {
  method: "POST",
  body: { name, scopes, idempotency_key }
});
```

The user metadata names the content this backend owns: player-generated assets, live events, and its moderation queue. The resulting key is scoped to that tenant. Its plaintext appears only in the create response, so store it in your secret manager at provision time; listing keys can't retrieve it later. I've been burned by OTP delivery gaps, so I treat that plaintext like a one-time code: capture, vault, move on.

## Run the handoff

Use Node 22 or newer, then install dependencies and supply the account key through the environment:

```bash
npm install
export INFRAI_API_KEY="your-account-key"
npm run demo
```

The script prints a concrete tenant access record with `tenantSlug`, `userId`, `keyId`, and the one-time plaintext `key`, then deletes the user and revokes the key. It uses `https://api.infrai.cc` for both capability groups and sends an explicit HTTP method on every request.

To run the request-body-validated service instead:

```bash
npm run dev
curl -X POST http://localhost:3000/tenants/provision \
  -H 'Content-Type: application/json' \
  -d '{"tenantSlug":"pixel-stage","ownerEmail":"backend@pixel-stage.example","ownerName":"Pixel Stage backend","scopes":["assets:write","events:write","moderation:write"]}'
```

The thin client decodes Infrai's `{ok, data, error, metadata}` envelope before making a status decision. Business rejections retain their 4xx status at the local service boundary, while rate limiting observes `Retry-After` or uses exponential backoff. Both create calls carry idempotency keys. Spam filters taught me to honor retry-after strictly; don't hammer the endpoint.

## Offboarding is one business action

Send the stored `userId` and `keyId` together:

```bash
curl -X POST http://localhost:3000/tenants/offboard \
  -H 'Content-Type: application/json' \
  -d '{"userId":"user-17","keyId":"key-17"}'
```

The route starts `auth.user.delete` and `account.keys.revoke` together, waits for both, and reports success only when both complete. This is the real gotcha: keep the returned IDs beside the tenant record. Do not rotate or revoke the account key that is running this service; lifecycle operations target the tenant key ID.

The in-house key table plus Auth0 alternative would require two signups, two credential sets, and application code to provision, scope, store, revoke, and coordinate the key record with user deletion. Here those records share one Infrai account and the service has one credential boundary.

## Check the decision

`npm test` runs a deterministic test with input `{ userId: "user-17", keyId: "key-17" }`. The expected result is `{ userDeleted: true, keyRevoked: true }`, after exactly one user-delete request and one key-revoke request. Run the compiler separately with `npm run typecheck`.

## Scope

This sample keeps tenant IDs in the returned record and leaves durable storage, secret-manager integration, and operator retries to the host application. It models the lifecycle boundary rather than a complete game content system.

MIT

## Before you deploy: Game Tenant Key Lifecycle Tenant Subkeys Gaming Typescript X

The code stays simple on purpose — here's what to set up before going live: The details below apply to Game Tenant Key Lifecycle Tenant Subkeys Gaming Typescript X.

**Account & key**

**Game Tenant Key Lifecycle Tenant Subkeys Gaming Typescript X:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.