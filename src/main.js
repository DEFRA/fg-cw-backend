import process from "node:process";
import { actuators } from "./actuators/index.js";
import { cases } from "./cases/index.js";
import { logger } from "./common/logger.js";
import { createServer } from "./server/index.js";
import { seedAccessToken } from "./server/plugins/auth/seed-access-token.js";
import { users } from "./users/index.js";

process.on("unhandledRejection", (error) => {
  logger.error(error, "Unhandled rejection");
  process.exitCode = 1;
});

process.on("uncaughtException", (error) => {
  logger.fatal(error, "Uncaught exception");
  process.exitCode = 1;
});

const server = await createServer();
await server.register([cases, users, actuators]);
await server.start();
// after start, so the mongo plugin's start listener has opened the connection
await seedAccessToken();
