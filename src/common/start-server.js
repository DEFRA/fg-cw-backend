import { createServer } from "../server.js";
import { logger } from "./logger.js";
import { db, mongoClient } from "../mongo-client.js";
import { up } from "migrate-mongo";

async function startServer(host, port) {
  let server;

  try {
    server = await createServer(host, port);
    await server.start();

    logger.info("Server started successfully");
    logger.info(`Access your backend on http://${host}:${port}`);

    logger.info("Running DB Migrations");

    // Database migrations
    await up(db, mongoClient);

    logger.info("Finished running DB Migrations");
  } catch (error) {
    logger.info("Server failed to start :(");
    logger.error(error);
  }

  return server;
}

export { startServer };
