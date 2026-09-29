import { logger } from "../../common/logger.js";
import { getTraceParent } from "../../common/trace-parent.js";
import {
  messageSource,
  saveInboxMessageUseCase,
} from "./save-inbox-message.use-case.js";

export const CONFIG_VERSION_UPDATED_EVENT_TYPE = "config-version.updated";

// An event with no grant cannot be grouped, but must still reach the inbox to
// be visible.
const UNGROUPED_SEGREGATION_REF = "unknown-grant";

const attribute = (attributes, key) => attributes?.[key]?.StringValue;

// SentTimestamp is epoch milliseconds in a string. The inbox claims a grant's
// events in eventTime order, so an unreadable one must not sort as garbage.
const toEventTime = (sentTimestamp) => {
  const epochMs = sentTimestamp ? Number(sentTimestamp) : Number.NaN;

  return Number.isNaN(epochMs)
    ? new Date().toISOString()
    : new Date(epochMs).toISOString();
};

// Saved without validation: a bad event has to reach the inbox to be seen.
export const saveConfigVersionInboxMessageUseCase = async (
  manifest,
  messageAttributes,
  { messageId, sentTimestamp } = {},
) => {
  const grantCode = attribute(messageAttributes, "grant");
  const version = attribute(messageAttributes, "version");
  const status = attribute(messageAttributes, "status");

  logger.info(
    `Received config version update: ${grantCode}@${version} (${status})`,
  );

  const event = {
    id: messageId,
    type: CONFIG_VERSION_UPDATED_EVENT_TYPE,
    time: toEventTime(sentTimestamp),
    traceparent: getTraceParent(),
    data: {
      grantCode,
      version,
      status,
      // The broker calls it "path", but it is the bucket it uploaded to.
      s3Bucket: attribute(messageAttributes, "path"),
      manifest,
    },
  };

  await saveInboxMessageUseCase(
    event,
    messageSource.ConfigBroker,
    grantCode || UNGROUPED_SEGREGATION_REF,
  );
};
