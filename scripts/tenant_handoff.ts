import { InfraiClient, INFRAI_BASE_URL } from "../src/infrai_client.js";
import { offboardGameTenant, provisionGameTenant } from "../src/tenant_lifecycle.js";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before running the handoff");

const infrai = new InfraiClient(key, INFRAI_BASE_URL);
const access = await provisionGameTenant(infrai, {
  tenantSlug: "pixel-stage",
  ownerEmail: "chenhua@changba.com",
  ownerName: "Pixel Stage backend",
  scopes: ["assets:write", "events:write", "moderation:write"]
});

console.log(JSON.stringify(access, null, 2));
await offboardGameTenant(infrai, { userId: access.userId, keyId: access.keyId });
