import { beforeEach, describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import {
  findByCaseRefAndWorkflowCode,
  update,
  updateClaimSupplementaryData,
} from "../repositories/case.repository.js";
import { handleClaimSubmittedUseCase } from "./handle-claim-submitted.use-case.js";
import { progressCaseUseCase } from "./progress-case.use-case.js";
vi.mock("../repositories/case.repository.js");
vi.mock("./progress-case.use-case.js");
const entry = {
  gasClaimId: "id-1",
  clientClaimRef: "claim-1",
  claimCode: "PA3",
  claimAmountPence: 150000,
  sbi: "113593357",
  status: "SUBMITTED",
  submittedAt: "2026-08-07T11:16:05.745Z",
};
const message = (claims = [entry]) => ({
  event: { data: { caseRef: "case-1", workflowCode: "woodland", claims } },
});
let kase;
beforeEach(() => {
  kase = Case.createMock();
  kase.supplementaryData = { agreements: [{ agreementRef: "existing" }] };
  findByCaseRefAndWorkflowCode.mockResolvedValue(kase);
});
describe("handleClaimSubmittedUseCase", () => {
  it("merges keyed claims without case progression or replacing the case", async () => {
    const before = structuredClone({
      position: kase.position,
      phases: kase.phases,
      timeline: kase.timeline,
      assignedUser: kase.assignedUser,
    });
    await handleClaimSubmittedUseCase(message());
    await handleClaimSubmittedUseCase(
      message([
        { ...entry, claimAmountPence: 0 },
        { ...entry, gasClaimId: "id-2" },
      ]),
    );
    expect(kase.supplementaryData.claims).toEqual([
      { ...entry, claimAmountPence: 0 },
      { ...entry, gasClaimId: "id-2" },
    ]);
    expect(kase.supplementaryData.agreements).toEqual([
      { agreementRef: "existing" },
    ]);
    expect(
      structuredClone({
        position: kase.position,
        phases: kase.phases,
        timeline: kase.timeline,
        assignedUser: kase.assignedUser,
      }),
    ).toEqual(before);
    expect(updateClaimSupplementaryData).toHaveBeenCalledWith(kase);
    expect(update).not.toHaveBeenCalled();
    expect(progressCaseUseCase).not.toHaveBeenCalled();
  });
  it("validates the entire batch before reading or mutating a case", async () => {
    await expect(
      handleClaimSubmittedUseCase(
        message([
          entry,
          { ...entry, gasClaimId: "id-2", claimAmountPence: -1 },
        ]),
      ),
    ).rejects.toThrow(/Invalid submitted claim/);
    expect(findByCaseRefAndWorkflowCode).not.toHaveBeenCalled();
    expect(updateClaimSupplementaryData).not.toHaveBeenCalled();
  });
  it("fails for a missing case so the inbox can retry", async () => {
    findByCaseRefAndWorkflowCode.mockResolvedValue(null);
    await expect(handleClaimSubmittedUseCase(message())).rejects.toMatchObject({
      output: { statusCode: 404 },
    });
    expect(updateClaimSupplementaryData).not.toHaveBeenCalled();
  });
  it("propagates persistence failure for inbox retry", async () => {
    updateClaimSupplementaryData.mockRejectedValue(new Error("write failed"));
    await expect(handleClaimSubmittedUseCase(message())).rejects.toThrow(
      "write failed",
    );
  });
});
