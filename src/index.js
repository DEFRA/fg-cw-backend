import process from "node:process";

import { startServer } from "./common/start-server.js";
import { logger } from "./common/logger.js";
import { config } from "./common/config.js";

await startServer(config.get("host"), config.get("port"));

process.on("unhandledRejection", (error) => {
  logger.info("Unhandled rejection");
  logger.error(error);
  process.exitCode = 1;
});
