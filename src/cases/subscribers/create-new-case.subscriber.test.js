import { describe, expect, it, vi } from "vitest";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import { Case } from "../models/case.js";
import { createCaseUseCase } from "../use-cases/create-case.use-case.js";
import { createNewCaseSubscriber } from "./create-new-case.subscriber.js";

vi.mock("../use-cases/create-case.use-case.js");

describe("createNewCaseSubscriber", () => {
  it("is an instance of SqsSubscriber", () => {
    expect(createNewCaseSubscriber).toBeInstanceOf(SqsSubscriber);
  });

  it("creates a case in response to CreateNewCase event", async () => {
    const message = {
      data: {
        code: "wf-001",
        payload: {
          clientRef: "TEST-001",
          code: "wf-001",
          createdAt: new Date().toISOString(),
          submittedAt: new Date().toISOString(),
          identifiers: {},
          answers: {},
        },
      },
    };

    createCaseUseCase.mockResolvedValue(
      Case.createMock({
        _id: "case-id-123",
        caseRef: "TEST-001",
        workflowCode: "wf-001",
        status: "NEW",
        dateReceived: new Date().toISOString(),
        payload: message.data.payload,
      }),
    );

    await createNewCaseSubscriber.onMessage(message);

    expect(createCaseUseCase).toHaveBeenCalledWith(message.data);
  });
});
