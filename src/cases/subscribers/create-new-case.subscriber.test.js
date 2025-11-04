import { describe, expect, it, vi } from "vitest";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import { saveInboxMessageUseCase } from "../use-cases/save-inbox-message.use-case.js";
import { createNewCaseSubscriber } from "./create-new-case.subscriber.js";

vi.mock("../use-cases/create-case.use-case.js");
vi.mock("../use-cases/save-inbox-message.use-case.js");

describe("createNewCaseSubscriber", () => {
  it("is an instance of SqsSubscriber", () => {
    expect(createNewCaseSubscriber).toBeInstanceOf(SqsSubscriber);
  });

  it("creates a case in response to CreateNewCase event", async () => {
    const message = {
      data: {
        caseRef: "TEST-001",
        workflowCode: "wf-001",
        payload: {
          createdAt: new Date().toISOString(),
          submittedAt: new Date().toISOString(),
          identifiers: {},
          answers: {},
        },
      },
    };

    saveInboxMessageUseCase.mockResolvedValue(true);

    await createNewCaseSubscriber.onMessage(message);

    expect(saveInboxMessageUseCase).toHaveBeenCalledWith(message, "GAS");
  });
});
