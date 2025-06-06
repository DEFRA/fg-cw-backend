import Boom from "@hapi/boom";
import { describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { publishCaseStageUpdated } from "../publishers/case-event.publisher.js";
import { updateStage } from "../repositories/case.repository.js";
import { changeCaseStageUseCase } from "./change-case-stage.use-case.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";

vi.mock("./find-case-by-id.use-case.js");
vi.mock("../repositories/case.repository.js");
vi.mock("../publishers/case-event.publisher.js");

describe("changeCaseStageUseCase", () => {
  it("uses findCaseByIdUseCase to get the case", async () => {
    const kase = new Case({
      _id: "test-case-id",
      caseRef: "TEST-001",
    });

    findCaseByIdUseCase.mockResolvedValue(kase);

    await changeCaseStageUseCase("test-case-id");

    expect(findCaseByIdUseCase).toHaveBeenCalledWith("test-case-id");
  });

  it("throws when case not found", async () => {
    findCaseByIdUseCase.mockRejectedValue(
      Boom.notFound('Case with id "non-existent-case-id" not found'),
    );

    await expect(
      changeCaseStageUseCase("non-existent-case-id"),
    ).rejects.toThrow('Case with id "non-existent-case-id" not found');
  });

  it("moves the case to the next stage", async () => {
    const kase = new Case({
      _id: "test-case-id",
      caseRef: "TEST-001",
    });

    findCaseByIdUseCase.mockResolvedValue(kase);

    await changeCaseStageUseCase("test-case-id");

    expect(updateStage).toHaveBeenCalledWith("test-case-id", "contract");
  });

  it("publishes CaseStageUpdated event", async () => {
    const kase = new Case({
      _id: "test-case-id",
      caseRef: "TEST-001",
      currentStage: "existing-stage",
    });

    findCaseByIdUseCase.mockResolvedValue(kase);

    await changeCaseStageUseCase("test-case-id");

    expect(publishCaseStageUpdated).toHaveBeenCalledWith(
      kase.caseRef,
      "existing-stage",
      "contract",
    );
  });
});
