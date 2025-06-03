import { createServer } from "../../server.js";
import { createLogger } from "./logging/logger.js";
import { db, mongoClient } from "../mongo-client.js";
import { up } from "migrate-mongo";

async function startServer(host, port) {
  let server;

  try {
    server = await createServer(host, port);
    await server.start();

    server.logger.info("Server started successfully");
    server.logger.info(`Access your backend on http://${host}:${port}`);

    server.logger.info("Running DB Migrations");

    // Database migrations
    await up(db, mongoClient);

    server.logger.info("Finished running DB Migrations");
  } catch (error) {
    const logger = createLogger();
    logger.info("Server failed to start :(");
    logger.error(error);
  }

  return server;
}

export { startServer };
