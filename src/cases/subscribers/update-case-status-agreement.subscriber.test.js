import { describe, expect, it, vi } from "vitest";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import { addAgreementToCaseUseCase } from "../use-cases/save-case-agreement.use-case.js";
import { createUpdateStatusAgreementConsumer } from "./update-case-status-agreement.subscriber.js";

vi.mock("../use-cases/save-case-agreement.use-case.js");

describe("update status command", () => {
  it("is an instance of sqs subscriber", () => {
    expect(createUpdateStatusAgreementConsumer).toBeInstanceOf(SqsSubscriber);
  });

  it("should process update case status command", async () => {
    addAgreementToCaseUseCase.mockResolvedValue({});
    const message = {
      data: {
        clientRef: "advetgstfsatftftfatftft",
        newStatus: "REVIEW",
        supplementaryData: {
          phase: "PRE_AWARD",
          stage: "AWARD",
          targetNode: "agreements",
          data: {
            agreementRef: "AGREEMENT-001",
            createdAt: "2023-10-01T12:00:00Z",
            agreementStatus: "OFFER",
          },
        },
      },
    };

    const expected = {
      caseRef: "advetgstfsatftftfatftft",
      newStatus: "REVIEW",
      supplementaryData: {
        phase: "PRE_AWARD",
        stage: "AWARD",
        targetNode: "agreements",
        data: {
          agreementRef: "AGREEMENT-001",
          createdAt: "2023-10-01T12:00:00Z",
          agreementStatus: "OFFER",
        },
      },
    };

    await createUpdateStatusAgreementConsumer.onMessage(message);
    expect(addAgreementToCaseUseCase).toBeCalledWith(expected);
  });
});
