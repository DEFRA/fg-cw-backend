import { describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { findById } from "../repositories/case.repository.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";

vi.mock("../repositories/case.repository.js");

describe("findCaseByIdUseCase", () => {
  it("finds case by id", async () => {
    const kase = new Case({ _id: "test-case-id" });

    findById.mockResolvedValue(kase);

    const result = await findCaseByIdUseCase("test-case-id");

    expect(findById).toHaveBeenCalledWith("test-case-id");

    expect(result).toBe(kase);
  });

  it("throws when case not found", async () => {
    findById.mockResolvedValue(null);

    await expect(findCaseByIdUseCase("non-existent-case-id")).rejects.toThrow(
      'Case with id "non-existent-case-id" not found',
    );
  });
});
