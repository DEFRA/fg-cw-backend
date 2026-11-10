import { MongoClient } from "mongodb";
import * as path from "node:path";
import { DockerComposeEnvironment, Wait } from "testcontainers";
import { hashToken } from "../src/server/plugins/auth/hash-token.js";
import { SERVICE_CLIENT, SERVICE_TOKEN } from "./helpers/service-token.js";
import { ensureQueues } from "./helpers/sqs.js";

let environment;

// A client other than fg-gas-backend, as any onboarded caller would be.
const insertServiceToken = async (uri) => {
  const client = await MongoClient.connect(uri);
  const id = hashToken(SERVICE_TOKEN);

  await client
    .db()
    .collection("access_tokens")
    .replaceOne(
      { id },
      { id, client: SERVICE_CLIENT, expiresAt: null },
      { upsert: true },
    );
  await client.close();
};

export const setup = async ({ globalConfig }) => {
  const { env } = globalConfig;

  const composeFilePath = path.resolve(import.meta.dirname, "..");

  environment = await new DockerComposeEnvironment(
    composeFilePath,
    "compose.yml",
  )
    .withBuild()
    .withEnvironment({
      CW_PORT: env.CW_PORT,
      MONGO_PORT: env.MONGO_PORT,
      FLOCI_PORT: env.FLOCI_PORT,
      ENTRA_PORT: env.ENTRA_PORT,
      // Keep ENVIRONMENT=local so cloud event types match test fixtures; disable definition cache instead.
      WORKFLOW_DEFINITION_CACHE_ENABLED: "false",
    })
    .withWaitStrategy("fg-cw-backend-1", Wait.forHttp("/health", env.CW_PORT))
    .withNoRecreate()
    .up();

  await insertServiceToken(env.MONGO_URI);

  await ensureQueues([
    env.CW__SQS__CREATE_NEW_CASE_URL,
    env.CW__SQS__UPDATE_STATUS_URL,
    env.GAS__SQS__UPDATE_STATUS,
    env.CW__SQS__CONFIG_VERSION_QUEUE_URL,
  ]);

  if (env.PRINT_LOGS) {
    try {
      const backendContainer = environment.getContainer("fg-cw-backend-1");
      const logStream = await backendContainer.logs();

      logStream
        .on("data", (line) => process.stdout.write(line))
        .on("err", (line) => process.stderr.write(line));
    } catch (err) {}
  }
};

export const teardown = async () => {
  await environment?.down();
};
