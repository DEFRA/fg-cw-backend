import process from "node:process";
import { cases } from "./cases/index.js";
import { logger } from "./common/logger.js";
import { createServer } from "./server/index.js";
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
await server.register([cases, users]);
await server.start();
