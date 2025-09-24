import { describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../repositories/case.repository.js";
import { updateCaseStatusWithDataUseCase } from "./update-case-status-with-data.use-case.js";

vi.mock("../repositories/case.repository.js");

describe("save case agreement use case", () => {
  it("should throw if case not found", async () => {
    findByCaseRefAndWorkflowCode.mockResolvedValue(null);

    await expect(() =>
      updateCaseStatusWithDataUseCase({
        caseRef: "ABCD1234",
        workflowCode: "workflow-1",
      }),
    ).rejects.toThrow(
      'Case with caseRef "ABCD1234" and workflowCode "workflow-1" not found',
    );
  });

  it("should add agreement data to case and call update", async () => {
    const data = {
      caseRef: "ABCD1234",
      workflowCode: "workflow-1",
      newStatus: "REVIEW",
      supplementaryData: {
        phase: null,
        stage: null,
        targetNode: "agreements",
        data: {
          agreementRef: "0987GHYU",
          agreementStatus: "OFFERED",
        },
      },
    };
    const kase = Case.createMock();

    findByCaseRefAndWorkflowCode.mockResolvedValue(kase);
    const returnvalue = await updateCaseStatusWithDataUseCase(data);

    const caseAgreements = kase.supplementaryData.agreements;
    expect(findByCaseRefAndWorkflowCode).toHaveBeenCalledWith(
      data.caseRef,
      data.workflowCode,
    );
    expect(caseAgreements["0987GHYU"].latestStatus).toBe("OFFERED");
    expect(caseAgreements["0987GHYU"].history).toHaveLength(1);
    expect(update).toHaveBeenCalledWith(kase);
    expect(returnvalue).toBe(kase);
  });
});
