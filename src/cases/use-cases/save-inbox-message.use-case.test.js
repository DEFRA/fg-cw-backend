import { describe, expect, it, vi } from "vitest";
import { logger } from "../../common/logger.js";
import { caseUpdateStatus } from "../events/inbound-event-types.js";
import { Inbox } from "../models/inbox.js";
import {
  findByMessageId,
  insertOne,
} from "../repositories/inbox.repository.js";
import { saveInboxMessageUseCase } from "./save-inbox-message.use-case.js";

vi.mock("../repositories/inbox.repository.js");

describe("saveInboxMessageUseCase", () => {
  it("saves a message", async () => {
    insertOne.mockResolvedValue(true);
    findByMessageId.mockResolvedValue(null);
    const message = {
      data: {
        caseRef: "caseref-1234",
        workflowCode: "workflow-1",
      },
    };
    await saveInboxMessageUseCase({ message, source: "Gas" });
    expect(findByMessageId).toHaveBeenCalledTimes(1);
    expect(insertOne).toHaveBeenCalledWith(expect.any(Inbox));
  });

  it("should do nothing id message is already saved", async () => {
    findByMessageId.mockResolvedValue({});
    vi.spyOn(logger, "warn");
    const message = {};
    await saveInboxMessageUseCase({ message, source: "Gas" });
    expect(logger.warn).toHaveBeenCalled();
    expect(insertOne).not.toHaveBeenCalled();
  });

  it("uses a segregationRef it is given instead of deriving one", async () => {
    insertOne.mockResolvedValue(true);
    findByMessageId.mockResolvedValue(null);

    await saveInboxMessageUseCase({
      message: {
        id: "msg-1",
        data: { caseRef: "caseref-1234", workflowCode: "wf" },
      },
      source: "CB",
      segregationRef: "woodland",
    });

    expect(insertOne.mock.calls.at(-1)[0].segregationRef).toBe("woodland");
  });

  it("stamps the row with the type's facts and the message's refs", async () => {
    insertOne.mockResolvedValue(true);
    findByMessageId.mockResolvedValue(null);

    await saveInboxMessageUseCase({
      message: {
        id: "MSG-1",
        type: caseUpdateStatus.sentAs,
        data: { caseRef: "ABC-123", workflowCode: "example-workflow" },
      },
      source: "GAS",
    });

    expect(insertOne.mock.calls.at(-1)[0]).toMatchObject({
      segregationRef: "ABC-123-example-workflow",
      eventType: "UpdateCaseStatus",
      refs: [
        "ref:abc-123",
        "case:example-workflow:~41.~42.~43.-123",
        "id:msg-1",
      ],
    });
  });

  it("returns at the duplicate check for a redelivery with no data", async () => {
    insertOne.mockClear();
    findByMessageId.mockResolvedValue({});

    await expect(
      saveInboxMessageUseCase({
        message: { id: "msg-1" },
        source: "CB",
        segregationRef: undefined,
      }),
    ).resolves.toBeUndefined();
    expect(insertOne).not.toHaveBeenCalled();
  });
});
