import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../common/logger.js";
import { fetchConfigFile } from "../../common/s3-client.js";
import { Inbox, InboxStatus } from "../models/inbox.js";
import { upsert } from "../repositories/config-version.repository.js";
import { update } from "../repositories/inbox.repository.js";
import { InboxSubscriber } from "../subscribers/inbox.subscriber.js";
import { CONFIG_VERSION_UPDATED_EVENT_TYPE } from "./save-config-version-inbox-message.use-case.js";

vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
}));
vi.mock("../../common/s3-client.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchConfigFile: vi.fn(),
}));
vi.mock("../repositories/inbox.repository.js");
vi.mock("../repositories/config-version.repository.js");
vi.mock("./submit-case.use-case.js");
vi.mock("./handle-case-status-update.use-case.js");
vi.mock("./update-supplementary-data.use-case.js");

beforeEach(() => {
  update.mockResolvedValue({ matchedCount: 1 });
});

describe("config updates without a Caseworking definition through the inbox", () => {
  it("completes the inbox message without a retry or config-version write", async () => {
    const message = new Inbox({
      source: "CB",
      type: CONFIG_VERSION_UPDATED_EVENT_TYPE,
      messageId: "config-without-cw",
      segregationRef: "woodland",
      event: {
        data: {
          grantCode: "woodland",
          version: "1.2.3",
          status: "active",
          s3Bucket: "configs-bucket",
          manifest: ["woodland/1.2.3/gas/gas.json"],
        },
      },
    });

    await new InboxSubscriber().handleEvent(message);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: InboxStatus.COMPLETED,
        completionAttempts: 0,
        attemptHistory: [],
        lastError: null,
      }),
      undefined,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Skipping config version: woodland@1.2.3"),
    );
    expect(fetchConfigFile).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
