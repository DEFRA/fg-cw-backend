import { describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { findAll } from "../repositories/case.repository.js";
import { findCasesUseCase } from "./find-cases.use-case.js";

vi.mock("../repositories/case.repository.js");

describe("findCasesUseCase", () => {
  it("finds cases", async () => {
    const result = [Case.createMock(), Case.createMock()];

    findAll.mockResolvedValue(result);

    const cases = await findCasesUseCase();

    expect(cases).toEqual(result);
    expect(findAll).toHaveBeenCalledWith();
  });
});
