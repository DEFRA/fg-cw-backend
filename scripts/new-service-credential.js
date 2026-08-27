/**
 * Generates a service credential pair for a client fg-cw-backend seeds at boot:
 * a raw bearer token, and the SHA-256 hash it is matched against.
 *
 * Usage: npm run token:new -- <client-name>
 *
 * Set the printed pair as fg-cw-backend's SERVICE_ACCESS_TOKEN_HASH secret in
 * the CDP portal, give the raw token to the calling service, and redeploy both.
 * Generate a separate pair per environment.
 */
import crypto from "node:crypto";
import { hashToken } from "../src/server/plugins/auth/hash-token.js";

const clientName = process.argv[2];

if (!clientName) {
  console.error("Usage: npm run token:new -- <client-name>");
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(clientName)) {
  console.error(
    `Invalid client name "${clientName}" - use lowercase letters, digits and hyphens`,
  );
  process.exit(1);
}

const raw = crypto.randomUUID();
const hash = hashToken(raw);

console.log(`Service credential for: ${clientName}`);
console.log("");
console.log("Set as fg-cw-backend's SERVICE_ACCESS_TOKEN_HASH secret:");
console.log(`${clientName}:${hash}`);
console.log("");
console.log(
  "Raw token - secret on the calling service (shown once, store now):",
);
console.log(raw);
