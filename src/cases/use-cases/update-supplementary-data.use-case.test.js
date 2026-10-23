import Boom from "@hapi/boom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import {
  findByCaseRefAndWorkflowCode,
  SUPPLEMENTARY_DATA_CONFLICT,
  update,
  updateSupplementaryData,
} from "../repositories/case.repository.js";
import { updateSupplementaryDataUseCase } from "./update-supplementary-data.use-case.js";
import { progressCaseUseCase } from "./progress-case.use-case.js";
vi.mock("../repositories/case.repository.js");
vi.mock("./progress-case.use-case.js");
const instruction = (data = { id: "result-1", arbitrary: { score: -10 } }) => ({
  targetNode: "results",
  dataType: "ARRAY",
  key: "id",
  data,
});
const message = (supplementaryData = instruction()) => ({
  event: {
    data: { caseRef: "case-1", workflowCode: "example", supplementaryData },
  },
});
let kase;
beforeEach(() => {
  kase = Case.createMock({ supplementaryData: { other: { retained: true } } });
  findByCaseRefAndWorkflowCode.mockResolvedValue(kase);
});
describe("generic supplementary data updates", () => {
  it("upserts opaque entries by key without progressing or replacing the case", async () => {
    const before = structuredClone({
      position: kase.position,
      phases: kase.phases,
      timeline: kase.timeline,
      assignedUser: kase.assignedUser,
    });
    await updateSupplementaryDataUseCase(message());
    await updateSupplementaryDataUseCase(
      message(instruction({ id: "result-1", completelyDifferent: true })),
    );
    await updateSupplementaryDataUseCase(
      message(
        instruction({ id: "result-2", arbitrary: [1, "anything", null] }),
      ),
    );
    expect(kase.supplementaryData.toJSON()).toEqual({
      other: { retained: true },
      results: [
        { id: "result-1", completelyDifferent: true },
        { id: "result-2", arbitrary: [1, "anything", null] },
      ],
    });
    expect(
      structuredClone({
        position: kase.position,
        phases: kase.phases,
        timeline: kase.timeline,
        assignedUser: kase.assignedUser,
      }),
    ).toEqual(before);
    expect(updateSupplementaryData).toHaveBeenCalledWith(kase);
    expect(update).not.toHaveBeenCalled();
    expect(progressCaseUseCase).not.toHaveBeenCalled();
  });
  it("supports keyed object storage", async () => {
    await updateSupplementaryDataUseCase(
      message({ ...instruction(), dataType: "OBJECT" }),
    );
    expect(kase.supplementaryData.toJSON().results).toEqual({
      "result-1": { id: "result-1", arbitrary: { score: -10 } },
    });
  });
  it("rejects invalid instructions before looking up or changing a case", async () => {
    await expect(
      updateSupplementaryDataUseCase(
        message({ ...instruction(), key: "missing" }),
      ),
    ).rejects.toThrow(/Invalid supplementary data update/);
    expect(findByCaseRefAndWorkflowCode).not.toHaveBeenCalled();
    expect(updateSupplementaryData).not.toHaveBeenCalled();
  });
  it("fails for a missing case so the inbox can retry", async () => {
    findByCaseRefAndWorkflowCode.mockResolvedValue(null);
    await expect(
      updateSupplementaryDataUseCase(message()),
    ).rejects.toMatchObject({ output: { statusCode: 404 } });
    expect(updateSupplementaryData).not.toHaveBeenCalled();
  });
  it("reloads and reapplies the instruction after a supplementary conflict", async () => {
    const fresh = Case.createMock({
      supplementaryData: { results: [{ id: "newer" }] },
    });
    findByCaseRefAndWorkflowCode
      .mockResolvedValueOnce(kase)
      .mockResolvedValueOnce(fresh);
    updateSupplementaryData
      .mockRejectedValueOnce(
        Boom.conflict("changed", SUPPLEMENTARY_DATA_CONFLICT),
      )
      .mockResolvedValueOnce();
    await updateSupplementaryDataUseCase(message());
    expect(updateSupplementaryData).toHaveBeenCalledTimes(2);
    expect(fresh.supplementaryData.toJSON().results).toEqual([
      { id: "newer" },
      { id: "result-1", arbitrary: { score: -10 } },
    ]);
  });
  it("leaves persistent conflicts to inbox retry after three attempts", async () => {
    const error = Boom.conflict("changed", SUPPLEMENTARY_DATA_CONFLICT);
    updateSupplementaryData.mockRejectedValue(error);
    await expect(updateSupplementaryDataUseCase(message())).rejects.toBe(error);
    expect(findByCaseRefAndWorkflowCode).toHaveBeenCalledTimes(3);
    expect(updateSupplementaryData).toHaveBeenCalledTimes(3);
  });
  it("propagates failed writes for retry", async () => {
    updateSupplementaryData.mockRejectedValue(new Error("write failed"));
    await expect(updateSupplementaryDataUseCase(message())).rejects.toThrow(
      "write failed",
    );
    expect(updateSupplementaryData).toHaveBeenCalledTimes(1);
  });
});
