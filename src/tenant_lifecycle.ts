import { randomUUID } from "node:crypto";
import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

export const provisionTenantBody = z.object({
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1),
  scopes: z.array(z.string().min(1)).min(1)
}).strict();

export const offboardTenantBody = z.object({
  userId: z.string().min(1),
  keyId: z.string().min(1)
}).strict();

export type ProvisionTenant = z.infer<typeof provisionTenantBody>;
export type OffboardTenant = z.infer<typeof offboardTenantBody>;

type CreatedUser = { user_id: string };
type CreatedKey = { key_id: string; key_secret: string };

export type TenantAccess = {
  tenantSlug: string;
  userId: string;
  keyId: string;
  key: string;
};

export async function provisionGameTenant(
  infrai: InfraiClient,
  input: ProvisionTenant
): Promise<TenantAccess> {
  const operationId = randomUUID();
  const user = await infrai.request<CreatedUser>("/v1/auth/user/create", {
    method: "POST",
    body: {
      email: input.ownerEmail,
      name: input.ownerName,
      metadata: {
        tenant_slug: input.tenantSlug,
        content_models: ["player_asset", "live_event", "moderation_queue"]
      },
      mode: "service",
      idempotency_key: `tenant-user:${operationId}`
    }
  });

  let tenantKey: CreatedKey;
  try {
    tenantKey = await infrai.request<CreatedKey>("/v1/account/keys/create", {
      method: "POST",
      body: {
        name: `${input.tenantSlug}-game-backend`,
        scopes: input.scopes,
        idempotency_key: `tenant-key:${operationId}`
      }
    });
  } catch (error) {
    await infrai.request<unknown>(
      `/v1/auth/user/delete/${encodeURIComponent(user.user_id)}`,
      { method: "DELETE" }
    );
    throw error;
  }

  return {
    tenantSlug: input.tenantSlug,
    userId: user.user_id,
    keyId: tenantKey.key_id,
    key: tenantKey.key_secret
  };
}

export async function offboardGameTenant(
  infrai: InfraiClient,
  input: OffboardTenant
): Promise<{ userDeleted: true; keyRevoked: true }> {
  const results = await Promise.allSettled([
    infrai.request<unknown>(`/v1/auth/user/delete/${encodeURIComponent(input.userId)}`, {
      method: "DELETE"
    }),
    infrai.request<unknown>(`/v1/account/keys/revoke/${encodeURIComponent(input.keyId)}`, {
      method: "DELETE"
    })
  ]);

  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((result) => (result as PromiseRejectedResult).reason),
      "Tenant offboarding did not complete both required calls"
    );
  }
  return { userDeleted: true, keyRevoked: true };
}
