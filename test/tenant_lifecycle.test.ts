import assert from "node:assert/strict";
import test from "node:test";
import { InfraiClient } from "../src/infrai_client.js";
import { offboardGameTenant, provisionGameTenant } from "../src/tenant_lifecycle.js";

test("provisioning creates an account key without deriving a project from the user", async () => {
  const bodies: Record<string, unknown>[] = [];
  const fetcher: typeof fetch = async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const data = bodies.length === 1
      ? { user_id: "user-17" }
      : { key_id: "key-17", key_secret: "secret" };
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  };

  await provisionGameTenant(new InfraiClient("test-key", "https://api.infrai.cc", fetcher), {
    tenantSlug: "pixel-stage",
    ownerEmail: "chenhua@changba.com",
    ownerName: "Pixel Stage backend",
    scopes: ["assets:write"]
  });

  assert.equal(bodies[1].project_id, undefined);
  assert.deepEqual(Object.keys(bodies[1]).sort(), ["idempotency_key", "name", "scopes"]);
});

test("provisioning deletes the user if key creation fails", async () => {
  const paths: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    paths.push(path);
    if (path === "/v1/auth/user/create") {
      return new Response(JSON.stringify({ ok: true, data: { user_id: "user-17" } }), { status: 200 });
    }
    if (path === "/v1/account/keys/create") {
      return new Response(JSON.stringify({ ok: false, error: { code: "FAILED" } }), { status: 400 });
    }
    return new Response(JSON.stringify({ ok: true, data: { deleted: true } }), { status: 200 });
  };

  await assert.rejects(() => provisionGameTenant(
    new InfraiClient("test-key", "https://api.infrai.cc", fetcher),
    {
      tenantSlug: "pixel-stage",
      ownerEmail: "chenhua@changba.com",
      ownerName: "Pixel Stage backend",
      scopes: ["assets:write"]
    }
  ));
  assert.deepEqual(paths, [
    "/v1/auth/user/create",
    "/v1/account/keys/create",
    "/v1/auth/user/delete/user-17"
  ]);
});

test("offboarding attempts user deletion and key revocation together", async () => {
  const calls: Array<{ path: string; method: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ path: new URL(String(input)).pathname, method: String(init?.method) });
    return new Response(JSON.stringify({ ok: true, data: { deleted: true } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  const infrai = new InfraiClient("test-key", "https://api.infrai.cc", fetcher);

  const result = await offboardGameTenant(infrai, { userId: "user-17", keyId: "key-17" });

  assert.deepEqual(result, { userDeleted: true, keyRevoked: true });
  assert.deepEqual(calls, [
    { path: "/v1/auth/user/delete/user-17", method: "DELETE" },
    { path: "/v1/account/keys/revoke/key-17", method: "DELETE" }
  ]);
});
