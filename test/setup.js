import process from "node:process";
import { TestContainers } from "./helpers/test-containers.js";

let containers;
let server;

export const setup = async ({ globalConfig }) => {
  const { env } = globalConfig;

  // Set env vars BEFORE importing modules that depend on config
  Object.assign(process.env, env);

  // Start infrastructure containers
  containers = new TestContainers();
  const containerEnv = await containers.start();

  // Merge container env with test config env
  Object.assign(process.env, containerEnv);

  console.log("🚀 Starting application...\n");

  // Import after env vars are set to avoid config validation errors
  const { createServer } = await import("../src/server/index.js");
  const { cases } = await import("../src/cases/index.js");
  const { users } = await import("../src/users/index.js");

  // Start the app server directly
  server = await createServer();
  await server.register([cases, users]);
  await server.start();

  // Set API_URL for tests to use
  process.env.API_URL = server.info.uri;

  console.log(`✅ Application ready at ${server.info.uri}\n`);
};

export const teardown = async () => {
  console.log("\n🛑 Shutting down test environment...");

  if (server) {
    await server.stop();
    console.log("✅ Application stopped");
  }

  if (containers) {
    await containers.stop();
  }
};
