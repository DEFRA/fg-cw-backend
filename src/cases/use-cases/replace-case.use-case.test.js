import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withTransaction } from "../../common/with-transaction.js";
import { CaseSeries } from "../models/case-series.js";
import { Case } from "../models/case.js";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../repositories/case-series.repository.js";
import { findByCaseRefAndWorkflowCode as findCase } from "../repositories/case.repository.js";
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
      caseRef: "TEST-001",
      caseId: "old-id",
    });
    const addCaseRefSpy = vi.spyOn(mockSeries, "addCaseRef");
    findByCaseRefAndWorkflowCode.mockResolvedValue(mockSeries);

    const mockPreviousCase = Case.createMock();
    mockPreviousCase.closed = true;
    findCase.mockResolvedValue(mockPreviousCase);

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
    expect(update.mock.calls[0][0]).toBeInstanceOf(CaseSeries);
    expect(findByCaseRefAndWorkflowCode).toHaveBeenCalledWith(
      "TEST-000",
      "wf-001",
      session,
    );
    expect(addCaseRefSpy).toHaveBeenCalledWith(
      "TEST-001",
      "123333333344455555666666",
    );
  });

  it("throws 409 if the previous case is not closed", async () => {
    newCaseUseCase.mockResolvedValue(new ObjectId("123333333344455555666666"));

    const mockCase = Case.createMock();

    const mockSeries = CaseSeries.new({
      workflowCode: "wf-001",
      caseRef: "TEST-001",
      caseId: "old-id",
    });
    findByCaseRefAndWorkflowCode.mockResolvedValue(mockSeries);
    findCase.mockResolvedValue(mockCase);

    const message = {
      event: {
        data: {
          caseRef: "TEST-001",
          previousCaseRef: "TEST-000",
          workflowCode: "wf-001",
        },
      },
    };

    await expect(replaceCaseUseCase(message)).rejects.toThrow(
      Boom.conflict(
        "Can not replace existing Case with caseRef: TEST-000 with new caseRef: TEST-001 - replacement is not allowed",
      ),
    );
  });
});
