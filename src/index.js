import process from "node:process";

import { config } from "./common/config.js";
import { logger } from "./common/logger.js";
import { startServer } from "./common/start-server.js";

await startServer(config.get("host"), config.get("port"));

process.on("unhandledRejection", (error) => {
  logger.info("Unhandled rejection");
  logger.error(error);
  process.exitCode = 1;
});
