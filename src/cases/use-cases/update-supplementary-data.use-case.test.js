import { describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";
import { updateSupplementaryDataUseCase } from "./update-supplementary-data.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("./find-workflow-by-code.use-case.js");

const testAgreement1 = {
  agreementRef: "agreement-1",
  agreementStatus: "OFFERED",
  createdAt: "2024-01-01T12:00:00Z",
  updatedAt: "2024-01-01T12:00:00Z",
};

const testAgreement2 = {
  agreementRef: "agreement-2",
  agreementStatus: "ACCEPTED",
  createdAt: "2024-01-02T12:00:00Z",
  updatedAt: "2024-01-02T14:00:00Z",
};

const testAgreement3 = {
  agreementRef: "agreement-3",
  agreementStatus: "OFFERED",
  createdAt: "2024-01-03T12:00:00Z",
  updatedAt: "2024-01-03T12:00:00Z",
};

const createTestMessage = (overrides = {}) => ({
  caseRef: "ABCD1234",
  workflowCode: "workflow-1",
  newStatus: "::REVIEW",
  supplementaryData: {
    phase: null,
    stage: null,
    targetNode: "agreements",
    data: [],
  },
  ...overrides,
});

describe("update supplementary data use case", () => {
  it("should throw if case not found", async () => {
    findByCaseRefAndWorkflowCode.mockResolvedValue(null);

    await expect(() =>
      updateSupplementaryDataUseCase({
        caseRef: "ABCD1234",
        workflowCode: "workflow-1",
      }),
    ).rejects.toThrow(
      'Case with caseRef "ABCD1234" and workflowCode "workflow-1" not found',
    );
  });

  it("should replace agreement data in case and call update", async () => {
    const data = createTestMessage({
      supplementaryData: {
        phase: null,
        stage: null,
        targetNode: "agreements",
        data: [testAgreement1],
      },
    });
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    vi.spyOn(kase, "progressTo").mockResolvedValue();

    findByCaseRefAndWorkflowCode.mockResolvedValue(kase);
    findWorkflowByCodeUseCase.mockResolvedValue(workflow);

    const returnValue = await updateSupplementaryDataUseCase(data);

    const caseAgreements = kase.supplementaryData.agreements;
    expect(findByCaseRefAndWorkflowCode).toHaveBeenCalledWith(
      data.caseRef,
      data.workflowCode,
    );
    expect(kase.progressTo).toHaveBeenCalledWith({
      position: expect.objectContaining({
        phaseCode: "",
        stageCode: "",
        statusCode: "REVIEW",
      }),
      workflow,
      createdBy: "System",
    });
    expect(caseAgreements).toHaveLength(1);
    expect(caseAgreements[0].agreementStatus).toBe("OFFERED");
    expect(caseAgreements[0].agreementRef).toBe("agreement-1");
    expect(update).toHaveBeenCalledWith(kase);
    expect(returnValue).toBe(kase);
  });

  it("should replace existing agreements with new complete array", async () => {
    const data = createTestMessage({
      supplementaryData: {
        phase: null,
        stage: null,
        targetNode: "agreements",
        data: [testAgreement2, testAgreement3],
      },
    });
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    kase.addSupplementaryData("agreements", [testAgreement1]);
    vi.spyOn(kase, "progressTo").mockReturnValue();

    findByCaseRefAndWorkflowCode.mockResolvedValue(kase);
    findWorkflowByCodeUseCase.mockResolvedValue(workflow);

    const returnValue = await updateSupplementaryDataUseCase(data);

    const caseAgreements = kase.supplementaryData.agreements;
    expect(findByCaseRefAndWorkflowCode).toHaveBeenCalledWith(
      data.caseRef,
      data.workflowCode,
    );
    expect(caseAgreements).toHaveLength(2);
    expect(caseAgreements[0].agreementRef).toBe("agreement-2");
    expect(caseAgreements[0].agreementStatus).toBe("ACCEPTED");
    expect(caseAgreements[1].agreementRef).toBe("agreement-3");
    expect(caseAgreements[1].agreementStatus).toBe("OFFERED");
    expect(update).toHaveBeenCalledWith(kase);
    expect(returnValue).toBe(kase);
  });

  it("should work with any targetNode, not just agreements", async () => {
    const data = createTestMessage({
      supplementaryData: {
        phase: null,
        stage: null,
        targetNode: "customData",
        data: {
          customField: "customValue",
        },
      },
    });
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    vi.spyOn(kase, "progressTo").mockReturnValue();

    findByCaseRefAndWorkflowCode.mockResolvedValue(kase);
    findWorkflowByCodeUseCase.mockResolvedValue(workflow);

    const returnValue = await updateSupplementaryDataUseCase(data);

    expect(kase.supplementaryData.customData).toEqual({
      customField: "customValue",
    });
    expect(update).toHaveBeenCalledWith(kase);
    expect(returnValue).toBe(kase);
  });

  it("should handle empty arrays", async () => {
    const data = createTestMessage();
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    kase.addSupplementaryData("agreements", [testAgreement1]);
    vi.spyOn(kase, "progressTo").mockReturnValue();

    findByCaseRefAndWorkflowCode.mockResolvedValue(kase);
    findWorkflowByCodeUseCase.mockResolvedValue(workflow);

    const returnValue = await updateSupplementaryDataUseCase(data);

    const caseAgreements = kase.supplementaryData.agreements;
    expect(caseAgreements).toHaveLength(0);
    expect(update).toHaveBeenCalledWith(kase);
    expect(returnValue).toBe(kase);
  });
});
