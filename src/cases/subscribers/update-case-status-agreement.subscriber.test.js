import { describe, expect, it, vi } from "vitest";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import { updateSupplementaryDataUseCase } from "../use-cases/update-supplementary-data.use-case.js";
import { createUpdateStatusAgreementConsumer } from "./update-case-status-agreement.subscriber.js";

vi.mock("../use-cases/update-supplementary-data.use-case.js");

describe("update status command", () => {
  it("is an instance of sqs subscriber", () => {
    expect(createUpdateStatusAgreementConsumer).toBeInstanceOf(SqsSubscriber);
  });

  it("should process update case status command", async () => {
    updateSupplementaryDataUseCase.mockResolvedValue({});
    const message = {
      data: {
        caseRef: "advetgstfsatftftfatftft",
        workflowCode: "workflow-code-1",
        newStatus: "REVIEW",
        supplementaryData: {
          phase: "PRE_AWARD",
          stage: "AWARD",
          targetNode: "agreements",
          data: [
            {
              agreementRef: "AGREEMENT-001",
              createdAt: "2023-10-01T12:00:00Z",
              updatedAt: "2023-10-01T12:00:00Z",
              agreementStatus: "OFFER",
            },
          ],
        },
      },
    };

    const expected = {
      caseRef: "advetgstfsatftftfatftft",
      workflowCode: "workflow-code-1",
      newStatus: "REVIEW",
      supplementaryData: {
        phase: "PRE_AWARD",
        stage: "AWARD",
        targetNode: "agreements",
        data: [
          {
            agreementRef: "AGREEMENT-001",
            createdAt: "2023-10-01T12:00:00Z",
            updatedAt: "2023-10-01T12:00:00Z",
            agreementStatus: "OFFER",
          },
        ],
      },
    };

    await createUpdateStatusAgreementConsumer.onMessage(message);
    expect(updateSupplementaryDataUseCase).toBeCalledWith(expected);
  });
});
