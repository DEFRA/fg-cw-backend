import { describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../repositories/case.repository.js";
import { updateSupplementaryDataUseCase } from "./update-supplementary-data.use-case.js";

vi.mock("../repositories/case.repository.js");

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

const createTestMessage = (overrides = {}) => ({
  caseRef: "ABCD1234",
  workflowCode: "workflow-1",
  newStatus: "REVIEW",
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
        newStatus: "foo",
        supplementaryData: {},
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
        dataType: "ARRAY",
        data: testAgreement1,
      },
    });
    const kase = Case.createMock();

    findByCaseRefAndWorkflowCode.mockResolvedValue(kase);
    const returnValue = await updateSupplementaryDataUseCase(data);

    const caseAgreements = kase.supplementaryData.agreements;
    expect(findByCaseRefAndWorkflowCode).toHaveBeenCalledWith(
      data.caseRef,
      data.workflowCode,
    );
    expect(caseAgreements).toHaveLength(1);
    expect(caseAgreements[0].agreementStatus).toBe("OFFERED");
    expect(caseAgreements[0].agreementRef).toBe("agreement-1");
    expect(update).toHaveBeenCalledWith(kase);
    expect(returnValue).toBe(kase);
  });

  it("should replace existing agreements", async () => {
    const data = createTestMessage({
      supplementaryData: {
        phase: null,
        stage: null,
        targetNode: "agreements",
        dataType: "ARRAY",
        key: "agreementRef",
        data: {
          ...testAgreement2,
          agreementRef: "agreement-1",
        },
      },
    });
    const kase = Case.createMock();
    kase.addSupplementaryData("agreements", [testAgreement1]);

    findByCaseRefAndWorkflowCode.mockResolvedValue(kase);
    const returnValue = await updateSupplementaryDataUseCase(data);

    const caseAgreements = kase.supplementaryData.agreements;
    expect(findByCaseRefAndWorkflowCode).toHaveBeenCalledWith(
      data.caseRef,
      data.workflowCode,
    );
    expect(caseAgreements).toHaveLength(1);
    expect(caseAgreements[0].agreementRef).toBe("agreement-1");
    expect(caseAgreements[0].agreementStatus).toBe("ACCEPTED");
    expect(update).toHaveBeenCalledWith(kase);
    expect(returnValue).toBe(kase);
  });

  it("should work with any targetNode, not just agreements", async () => {
    const data = createTestMessage({
      supplementaryData: {
        phase: null,
        stage: null,
        targetNode: "customData",
        dataType: "OBJECT",
        key: "customField",
        data: {
          customField: "customValue",
        },
      },
    });
    const kase = Case.createMock();

    findByCaseRefAndWorkflowCode.mockResolvedValue(kase);
    const returnValue = await updateSupplementaryDataUseCase(data);

    expect(kase.supplementaryData.customData).toEqual({
      customValue: {
        customField: "customValue",
      },
    });
    expect(update).toHaveBeenCalledWith(kase);
    expect(returnValue).toBe(kase);
  });
});
