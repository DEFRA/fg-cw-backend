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
    const kase = Case.createMock();

    findCaseByIdUseCase.mockResolvedValue(kase);

    await changeCaseStageUseCase(kase._id);

    expect(findCaseByIdUseCase).toHaveBeenCalledWith(kase._id);
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
    const kase = Case.createMock();

    findCaseByIdUseCase.mockResolvedValue(kase);

    await changeCaseStageUseCase(kase._id);

    expect(updateStage).toHaveBeenCalledWith(kase._id, "stage-2");
  });

  it("publishes CaseStageUpdated event", async () => {
    const kase = Case.createMock();

    findCaseByIdUseCase.mockResolvedValue(kase);

    await changeCaseStageUseCase(kase._id);

    expect(publishCaseStageUpdated).toHaveBeenCalledWith({
      caseRef: kase.caseRef,
      previousStage: kase.currentStage,
      currentStage: "stage-2",
    });
  });
});
