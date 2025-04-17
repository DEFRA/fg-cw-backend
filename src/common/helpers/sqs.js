import createSqsService from "../../service/sqs.service.js";
import { config } from "../../config.js";

const sqsConfig = config.get("sqs");

export const sqs = {
  plugin: {
    name: "sqs",
    version: "1.0.0",
    register: async function (server, options) {
      server.logger.info("Setting up SQS");

      const {
        region = sqsConfig.region,
        endpoint,
        queueUrl = sqsConfig.createCaseQueueUrl,
        maxMessages = sqsConfig.maxMessages,
        waitTimeSeconds = sqsConfig.waitTimeSeconds,
        autoDelete = sqsConfig.autoDelete,
        maxRetries = sqsConfig.maxRetries
      } = options;

      // Determine the endpoint with proper fallback
      const finalEndpoint =
        process.env.NODE_ENV !== "production"
          ? endpoint || sqsConfig.endpoint || "http://localhost:4566"
          : endpoint || sqsConfig.endpoint;

      // Create the SQS service instance
      const sqsService = createSqsService({
        region,
        endpoint: finalEndpoint
      });

      server.decorate("server", "sqs", sqsService);

      // Only start polling if a queue URL is provided
      if (queueUrl) {
        server.logger.info(`Setting up SQS polling for queue: ${queueUrl}`);

        const messageHandler = async (message) => {
          const db = server.db;
          if (!db) {
            server.logger.error(
              "Database not available for processing SQS message"
            );
            throw new Error("Database not available");
          }
          return sqsService.processMessage(message, db);
        };

        // Start polling for messages
        const poller = sqsService.startPolling({
          queueUrl,
          messageHandler,
          maxMessages,
          waitTimeSeconds,
          autoDelete,
          maxRetries
        });

        server.app.sqsPoller = poller;

        server.events.on("stop", () => {
          server.logger.info("Server stopping, stopping SQS poller");
          if (server.app.sqsPoller) {
            server.app.sqsPoller.stop();
          }
        });
      } else {
        server.logger.info(
          "No SQS queue URL provided, skipping SQS poller setup"
        );
      }
    }
  },
  options: {
    region: sqsConfig.region,
    endpoint: sqsConfig.endpoint,
    queueUrl: sqsConfig.createCaseQueueUrl,
    maxMessages: sqsConfig.maxMessages,
    waitTimeSeconds: sqsConfig.waitTimeSeconds,
    autoDelete: sqsConfig.autoDelete,
    maxRetries: sqsConfig.maxRetries
  }
};
