import process from "node:process";

import { createLogger } from "./common/helpers/logging/logger.js";
import { startServer } from "./common/helpers/start-server.js";
import { config } from "./config.js";

await startServer(config.get("host"), config.get("port"));

process.on("unhandledRejection", (error) => {
  const logger = createLogger();
  logger.info("Unhandled rejection");
  logger.error(error);
  process.exitCode = 1;
});
