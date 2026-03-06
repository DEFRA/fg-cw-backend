import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withTransaction } from "../../common/with-transaction.js";
import { CaseSeries } from "../models/case-series.js";
import {
  findByCaseRefAndWorkflowCode,
  save,
} from "../repositories/case-series.repository.js";
import { newCaseUseCase } from "./new-case.use-case.js";
import { replaceCaseUseCase } from "./replace-case.use-case.js";

vi.mock("../../common/with-transaction.js");
vi.mock("../repositories/case.repository.js");
vi.mock("../repositories/case-series.repository.js");
vi.mock("./new-case.use-case.js");

describe("replaceCaseUseCase", () => {
  const session = {};

  beforeEach(() => {
    withTransaction.mockImplementation((cb) => cb(session));
  });

  it("creates a new case, finds the series, updates it and saves", async () => {
    newCaseUseCase.mockResolvedValue(new ObjectId("123333333344455555666666"));

    const mockSeries = CaseSeries.new({
      workflowCode: "wf-001",
      latestCaseId: "old-id",
      latestCaseRef: "TEST-001",
    });
    const addCaseRefSpy = vi.spyOn(mockSeries, "addCaseRef");
    findByCaseRefAndWorkflowCode.mockResolvedValue(mockSeries);

    const message = {
      event: {
        data: {
          caseRef: "TEST-001",
          previousCaseRef: "TEST-000",
          workflowCode: "wf-001",
        },
      },
    };

    await replaceCaseUseCase(message);

    expect(withTransaction).toHaveBeenCalled();
    expect(newCaseUseCase).toHaveBeenCalledWith(message, session);
    expect(save.mock.calls[0][0]).toBeInstanceOf(CaseSeries);
    expect(findByCaseRefAndWorkflowCode).toHaveBeenCalledWith(
      "TEST-001",
      "wf-001",
      session,
    );
    expect(addCaseRefSpy).toHaveBeenCalledWith(
      "TEST-001",
      "123333333344455555666666",
    );
  });
});
