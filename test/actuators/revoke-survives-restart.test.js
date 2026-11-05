import { MongoClient, ObjectId } from "mongodb";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { env } from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashToken } from "../../src/server/plugins/auth/hash-token.js";
import { seedCaseReaderToken } from "../helpers/actuators.js";
import { operatorHeaders } from "../helpers/operator.js";
import { CASE_READER_TOKEN } from "../helpers/service-token.js";
import { wreck } from "../helpers/wreck.js";

const run = promisify(execFile);
const CLIENT = `it-restart-${new ObjectId().toHexString().slice(-6)}`;
const HEALTH_ATTEMPTS = 60;
// The subscribers' WaitTimeSeconds. floci keeps a stopped process's long polls
// open until then and hands them the next message, which stays invisible for
// the visibility timeout and stalls whichever suite sends it.
const LONG_POLL_MS = 20_000;

let client;
let accessTokens;

// The service container this suite started: the one publishing CW_PORT.
const serviceContainer = async () => {
  const { stdout } = await run("docker", [
    "ps",
    "--filter",
    "label=com.docker.compose.service=fg-cw-backend",
    "--format",
    "{{.Names}}\t{{.Ports}}",
  ]);
  const published = `0.0.0.0:${env.CW_PORT}->`;
  const [name] = stdout
    .split("\n")
    .filter((line) => line.includes(published))
    .map((line) => line.split("\t")[0]);

  return name;
};

const status = async (request) => {
  try {
    return (await request()).res.statusCode;
  } catch (error) {
    return error.output?.statusCode ?? 0;
  }
};

const waitUntilHealthy = async () => {
  for (let attempt = 0; attempt < HEALTH_ATTEMPTS; attempt += 1) {
    if ((await status(() => wreck.get("/health"))) === 200) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("fg-cw-backend did not come back");
};

const rolesStatus = (raw) =>
  status(() =>
    wreck.get("/api/users/00000000-0000-0000-0000-000000000000/roles", {
      headers: { authorization: `Bearer ${raw}` },
    }),
  );

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  accessTokens = client.db().collection("access_tokens");
  await seedCaseReaderToken(client.db());
});

afterAll(async () => {
  await accessTokens.deleteMany({ client: CLIENT });
  await client?.close(true);
});

describe("a revoked token", () => {
  it("still fails after the service restarts", async () => {
    const raw = randomBytes(32).toString("base64url");
    const { payload } = await wreck.post(
      `/actuators/clients/${CLIENT}/tokens`,
      {
        headers: {
          authorization: `Bearer ${CASE_READER_TOKEN}`,
          ...operatorHeaders,
        },
        payload: {
          tokenHash: hashToken(raw),
          tokenHint: raw.slice(-4),
          newClient: true,
        },
      },
    );
    await wreck.post(
      `/actuators/clients/${CLIENT}/tokens/${payload.token.tokenId}/revoke`,
      {
        headers: {
          authorization: `Bearer ${CASE_READER_TOKEN}`,
          ...operatorHeaders,
        },
      },
    );
    expect(await rolesStatus(raw)).toBe(401);

    const container = await serviceContainer();
    expect(container).toBeTruthy();
    await run("docker", ["stop", container]);
    await sleep(LONG_POLL_MS);
    await run("docker", ["start", container]);
    await waitUntilHealthy();

    expect(await rolesStatus(raw)).toBe(401);
  }, 120_000);
});
