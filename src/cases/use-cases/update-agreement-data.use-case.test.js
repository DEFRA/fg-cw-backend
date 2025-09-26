import { describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../repositories/case.repository.js";
import { updateAgreementDataUseCase } from "./update-agreement-data.use-case.js";

vi.mock("../repositories/case.repository.js");

describe("save case agreement use case", () => {
  it("should throw if case not found", async () => {
    findByCaseRefAndWorkflowCode.mockResolvedValue(null);

    await expect(() =>
      updateAgreementDataUseCase({
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
    const returnvalue = await updateAgreementDataUseCase(data);

    const caseAgreements = kase.supplementaryData.agreements;
    expect(findByCaseRefAndWorkflowCode).toHaveBeenCalledWith(
      data.caseRef,
      data.workflowCode,
    );
    expect(caseAgreements[0].agreementStatus).toBe("OFFERED");
    expect(caseAgreements[0].agreementRef).toBe("0987GHYU");
    expect(update).toHaveBeenCalledWith(kase);
    expect(returnvalue).toBe(kase);
  });
});
