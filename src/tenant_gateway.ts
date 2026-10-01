import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiClient, InfraiError, INFRAI_BASE_URL } from "./infrai_client.js";
import {
  offboardGameTenant,
  offboardTenantBody,
  provisionGameTenant,
  provisionTenantBody
} from "./tenant_lifecycle.js";

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function includesBusinessRejection(error: AggregateError): boolean {
  return error.errors.some(
    (reason) => reason instanceof InfraiError && reason.status >= 400 && reason.status < 500
  );
}

export function createTenantGateway(infrai: InfraiClient) {
  return createServer(async (request, response) => {
    try {
      if (request.method === "POST" && request.url === "/tenants/provision") {
        const input = provisionTenantBody.parse(await readJson(request));
        send(response, 201, await provisionGameTenant(infrai, input));
        return;
      }
      if (request.method === "POST" && request.url === "/tenants/offboard") {
        const input = offboardTenantBody.parse(await readJson(request));
        send(response, 200, await offboardGameTenant(infrai, input));
        return;
      }
      send(response, 404, { error: "Route not found" });
    } catch (error) {
      if (error instanceof ZodError) {
        send(response, 400, { error: "Invalid request body", issues: error.issues });
      } else if (error instanceof InfraiError) {
        send(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
          error: error.code,
          message: error.message
        });
      } else if (error instanceof AggregateError && includesBusinessRejection(error)) {
        send(response, 409, { error: "Tenant offboarding incomplete" });
      } else {
        send(response, 502, { error: "Tenant lifecycle operation incomplete" });
      }
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before starting the service");
  const port = Number(process.env.PORT ?? 3000);
  createTenantGateway(new InfraiClient(key, INFRAI_BASE_URL)).listen(port, () => {
    console.log(`Tenant gateway listening on http://localhost:${port}`);
  });
}
