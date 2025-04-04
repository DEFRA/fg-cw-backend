import { createServer } from "../../server.js";
import { createLogger } from "./logging/logger.js";

async function startServer(host, port) {
  let server;

  try {
    server = await createServer(host, port);
    await server.start();

    server.logger.info("Server started successfully");
    server.logger.info(`Access your backend on http://${host}:${port}`);
  } catch (error) {
    const logger = createLogger();
    logger.info("Server failed to start :(");
    logger.error(error);
  }

  return server;
}

export { startServer };
