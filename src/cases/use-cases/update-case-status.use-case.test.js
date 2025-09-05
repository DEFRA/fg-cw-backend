import { describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { findByCaseRef, update } from "../repositories/case.repository.js";
import { updateCaseStatusUseCase } from "./update-case-status.use-case.js";

vi.mock("../repositories/case.repository.js");

describe("save case agreement use case", () => {
  it("should throw if case not found", async () => {
    findByCaseRef.mockResolvedValue(null);

    await expect(() =>
      updateCaseStatusUseCase({ caseRef: "ABCD1234" }),
    ).rejects.toThrow('Case with ref "ABCD1234" not found');
  });

  it("should add agreement data to case and call update", async () => {
    const data = {
      caseRef: "ABCD1234",
      newStatus: "REVIEW",
      supplementaryData: {
        phase: "PRE_AWARD",
        stage: "award",
        targetNode: "agreements",
        data: {
          agreementRef: "0987GHYU",
        },
      },
    };
    const kase = Case.createMock();
    kase.stages.push({
      id: "award",
      agreements: [],
    });
    findByCaseRef.mockResolvedValue(kase);
    const returnvalue = await updateCaseStatusUseCase(data);

    expect(findByCaseRef).toHaveBeenCalledWith(data.caseRef);
    expect(
      kase.stages.find((s) => s.id === "award").agreements[0].agreementRef,
    ).toBe("0987GHYU");
    expect(update).toHaveBeenCalledWith(kase);
    expect(returnvalue).toBe(kase);
  });
});
