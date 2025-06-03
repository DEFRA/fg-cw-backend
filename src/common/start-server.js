import { createServer } from "../server.js";
import { logger } from "./logger.js";
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
    await up(server.db, server.mongoClient);

    server.logger.info("Finished running DB Migrations");
  } catch (error) {
    logger.info("Server failed to start :(");
    logger.error(error);
  }

  return server;
}

export { startServer };
