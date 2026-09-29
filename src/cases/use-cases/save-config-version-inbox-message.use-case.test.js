import { beforeEach, describe, expect, it, vi } from "vitest";
import { withTraceParent } from "../../common/trace-parent.js";
import { Inbox, InboxStatus } from "../models/inbox.js";
import {
  findByMessageId,
  insertOne,
} from "../repositories/inbox.repository.js";
import {
  CONFIG_VERSION_UPDATED_EVENT_TYPE,
  saveConfigVersionInboxMessageUseCase,
} from "./save-config-version-inbox-message.use-case.js";

vi.mock("../repositories/inbox.repository.js");

const TRACEPARENT = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";
const MANIFEST = ["woodland/1.2.3/cw/cw.json", "woodland/1.2.3/metadata.json"];

const attributes = (overrides = {}) => ({
  grant: { DataType: "String", StringValue: "woodland" },
  version: { DataType: "String", StringValue: "1.2.3" },
  status: { DataType: "String", StringValue: "active" },
  path: { DataType: "String", StringValue: "test-grants-config-6bf3a" },
  ...overrides,
});

const save = (overrides, metadata = {}) =>
  withTraceParent(TRACEPARENT, () =>
    saveConfigVersionInboxMessageUseCase(MANIFEST, attributes(overrides), {
      messageId: "msg-1",
      sentTimestamp: "1758106800000",
      ...metadata,
    }),
  );

const saved = () => insertOne.mock.calls[0][0];

describe("saveConfigVersionInboxMessageUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findByMessageId.mockResolvedValue(null);
    insertOne.mockResolvedValue({ acknowledged: true });
  });

  it("saves the message to the inbox as a config-version.updated event from CB", async () => {
    await save();

    expect(saved()).toBeInstanceOf(Inbox);
    expect(saved()).toMatchObject({
      messageId: "msg-1",
      type: CONFIG_VERSION_UPDATED_EVENT_TYPE,
      source: "CB",
      segregationRef: "woodland",
      status: InboxStatus.PUBLISHED,
      traceparent: TRACEPARENT,
      eventTime: "2025-09-17T11:00:00.000Z",
    });
  });

  it("wraps the manifest and attributes in the event, taking the bucket from path", async () => {
    await save();

    expect(saved().event).toEqual({
      id: "msg-1",
      type: "config-version.updated",
      time: "2025-09-17T11:00:00.000Z",
      traceparent: TRACEPARENT,
      data: {
        grantCode: "woodland",
        version: "1.2.3",
        status: "active",
        s3Bucket: "test-grants-config-6bf3a",
        manifest: MANIFEST,
      },
    });
  });

  it("saves a message with no grant under unknown-grant, so it is still visible", async () => {
    await save({ grant: undefined });

    expect(saved().segregationRef).toBe("unknown-grant");
    expect(saved().event.data.grantCode).toBeUndefined();
  });

  it("saves a message with no path, leaving the bucket empty for the handler to refuse", async () => {
    await save({ path: undefined });

    expect(saved().event.data.s3Bucket).toBeUndefined();
  });

  it("falls back to the time it was saved when the sent time cannot be read", async () => {
    const before = Date.now();

    await save({}, { sentTimestamp: "not-a-number" });

    expect(Date.parse(saved().eventTime)).toBeGreaterThanOrEqual(before);
  });

  it("does not save the same SQS message twice", async () => {
    findByMessageId.mockResolvedValue({ messageId: "msg-1" });

    await save();

    expect(findByMessageId).toHaveBeenCalledWith("msg-1");
    expect(insertOne).not.toHaveBeenCalled();
  });
});
