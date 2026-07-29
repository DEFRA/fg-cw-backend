import { beforeEach, describe, expect, it, vi } from "vitest";
import { findById } from "../repositories/case.repository.js";
import { loadCase } from "./load-case.js";

vi.mock("../repositories/case.repository.js");

describe("loadCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the case by caseId and records caseRef on the command", async () => {
    findById.mockResolvedValue({ _id: "case-1", caseRef: "CASE-REF-1" });

    const command = { caseId: "case-1" };
    const kase = await loadCase(command);

    expect(findById).toHaveBeenCalledWith("case-1");
    expect(kase).toEqual({ _id: "case-1", caseRef: "CASE-REF-1" });
    expect(command.caseRef).toBe("CASE-REF-1");
  });

  it("throws a 404 when the case is not found", async () => {
    findById.mockResolvedValue(null);

    const command = { caseId: "missing" };

    await expect(loadCase(command)).rejects.toThrow(
      'Case with id "missing" not found',
    );
    expect(command.caseRef).toBeUndefined();
  });
});
