import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand
} from "@aws-sdk/client-sqs";
import { createLogger } from "../common/helpers/logging/logger.js";
import { caseService } from "./case.service.js";

const logger = createLogger();

const createSqsClient = (options = {}) => {
  return new SQSClient({
    region: options.region || "eu-west-2",
    ...options
  });
};

const receiveMessages = async (
  client,
  {
    queueUrl,
    maxMessages = 10,
    waitTimeSeconds = 20,
    attributeNames = ["All"],
    messageAttributeNames = ["All"],
    autoDelete = false,
    messageHandler = null,
    maxRetries = 3
  } = {}
) => {
  try {
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: waitTimeSeconds,
      AttributeNames: attributeNames,
      MessageAttributeNames: messageAttributeNames
    });

    const response = await client.send(command);
    const messages = response.Messages || [];

    logger.info(`Received ${messages.length} messages from SQS queue`);

    if (messages.length > 0) {
      if (messageHandler && typeof messageHandler === "function") {
        for (const message of messages) {
          try {
            await messageHandler(message);

            if (autoDelete) {
              await deleteMessage(client, {
                queueUrl,
                receiptHandle: message.ReceiptHandle
              });
            }
          } catch (error) {
            // Get retry count from message attributes
            const retryCount = message.Attributes?.ApproximateReceiveCount
              ? parseInt(message.Attributes.ApproximateReceiveCount, 10) - 1
              : 0;

            // If we haven't exceeded the max retries, we'll make the message visible again
            // Otherwise, do nothing and let SQS move it to the DLQ based on the redrive policy see aws.env
            if (retryCount < maxRetries) {
              // Return message to queue with a backoff delay (retry with increasing delay)
              // For example: 1st retry: 30s, 2nd retry: 60s, 3rd retry: 120s
              const backoffDelay = Math.pow(2, retryCount) * 30;

              logger.info(
                `Returning message to queue with visibility timeout ${backoffDelay}s`,
                {
                  messageId: message.MessageId,
                  retryCount,
                  backoffDelay
                }
              );

              try {
                // Make message invisible for the backoff period,
                // used to prevent the same message being processed multiple times
                await changeMessageVisibility(client, {
                  queueUrl,
                  receiptHandle: message.ReceiptHandle,
                  visibilityTimeout: backoffDelay
                });
              } catch (visibilityError) {
                logger.error(
                  `Failed to change message visibility: ${visibilityError.message}`,
                  {
                    error: visibilityError,
                    messageId: message.MessageId
                  }
                );
              }
            } else {
              logger.warn(
                `Message exceeded maximum retries (${maxRetries}), will be moved to DLQ`,
                {
                  messageId: message.MessageId,
                  retryCount
                }
              );

              // Message will be moved to DLQ based on the redrive policy see aws.env for details
            }
          }
        }
      }
    }

    return messages;
  } catch (error) {
    logger.error(`Error receiving messages from queue: ${error.message}`, {
      error
    });
    throw error;
  }
};

const deleteMessage = async (client, { queueUrl, receiptHandle }) => {
  try {
    const command = new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle
    });

    logger.info("Deleting message from SQS queue");
    return await client.send(command);
  } catch (error) {
    logger.error(`Error deleting message from queue: ${error.message}`, {
      error
    });
    throw error;
  }
};

const startPolling = (client, options = {}) => {
  const {
    queueUrl,
    messageHandler,
    maxMessages = 10,
    waitTimeSeconds = 20,
    autoDelete = true,
    maxRetries = 3
  } = options;

  if (!queueUrl) {
    throw new Error("Queue URL is required for polling");
  }

  if (!messageHandler || typeof messageHandler !== "function") {
    throw new Error("Message handler function is required for polling");
  }

  let isPolling = true;

  const poll = async () => {
    while (isPolling) {
      try {
        await receiveMessages(client, {
          queueUrl,
          maxMessages,
          waitTimeSeconds,
          autoDelete,
          messageHandler,
          maxRetries
        });
      } catch (error) {
        logger.error(`Polling error: ${error.message}`, { error });
        await new Promise((resolve) => setTimeout(resolve, 5000));

        if (error.name === "AbortError" || error.message.includes("shutdown")) {
          isPolling = false;
        }
      }
    }
  };

  poll();

  return {
    stop: () => {
      isPolling = false;
      logger.info("SQS polling stopped");
    }
  };
};

const processMessage = async (messageEvent, db) => {
  logger.info("Processing case creation message", {
    messageId: messageEvent.MessageId
  });

  try {
    // Get retry count from message attributes
    const { Body: body, MessageId: messageId } = messageEvent;

    let caseEvent;

    try {
      caseEvent = JSON.parse(body);
    } catch (parseError) {
      logger.error("Failed to parse message body as JSON", {
        error: parseError,
        messageId,
        body
      });
      throw parseError;
    }

    const { Message: caseInfo } = caseEvent;
    const newCase = await caseService.handleCreateCaseEvent(
      JSON.parse(caseInfo),
      db
    );

    logger.info("Successfully created new case from SQS message");

    return newCase;
  } catch (error) {
    logger.error("Error processing case creation message:", {
      error: error.message,
      stack: error.stack,
      messageId: messageEvent.MessageId
    });

    throw error;
  }
};

const changeMessageVisibility = async (
  client,
  { queueUrl, receiptHandle, visibilityTimeout }
) => {
  try {
    const command = new ChangeMessageVisibilityCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
      VisibilityTimeout: visibilityTimeout
    });

    logger.info(
      `Changing message visibility timeout to ${visibilityTimeout} seconds`
    );
    return await client.send(command);
  } catch (error) {
    logger.error(`Error changing message visibility: ${error.message}`, {
      error
    });
    throw error;
  }
};

const createSqsService = (options = {}) => {
  const client = createSqsClient(options);

  return {
    client,
    receiveMessages: (params) => receiveMessages(client, params),
    deleteMessage: (params) => deleteMessage(client, params),
    startPolling: (params) => startPolling(client, params),
    processMessage,
    changeMessageVisibility: (params) => changeMessageVisibility(client, params)
  };
};

export default createSqsService;
