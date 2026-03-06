import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withTransaction } from "../../common/with-transaction.js";
import { CaseSeries } from "../models/case-series.js";
import { save } from "../repositories/case-series.repository.js";
import { newCaseUseCase } from "./new-case.use-case.js";
import { replaceCaseUseCase } from "./replace-case.use-case.js";
import { submitCaseUseCase } from "./submit-case.use-case.js";

vi.mock("../../common/with-transaction.js");
vi.mock("./new-case.use-case.js");
vi.mock("./replace-case.use-case.js");
vi.mock("../repositories/case-series.repository.js");

describe("submitCaseUseCase", () => {
  const session = {};
  beforeEach(() => {
    withTransaction.mockImplementation((cb) => cb(session));
  });

  it("should call create a new case when no previousCaseRef is passed", async () => {
    const caseSeriesNewSpy = vi.spyOn(CaseSeries, "new");
    save.mockResolvedValue();
    newCaseUseCase.mockResolvedValue(new ObjectId("123456789123456789123456"));

    const message = {
      event: {
        data: {
          caseRef: "1234",
          workflowCode: "foo",
        },
      },
    };
    await submitCaseUseCase(message);
    expect(newCaseUseCase).toHaveBeenCalled();
    expect(caseSeriesNewSpy).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
    expect(save.mock.calls[0][0]).toBeInstanceOf(CaseSeries);
    expect(withTransaction).toHaveBeenCalled();
  });

  it("should replace a case when previousCaseRef is passed", async () => {
    const message = {
      event: {
        data: {
          workflowCode: "foo",
          caseRef: "23356",
          previousCaseRef: "4321",
        },
      },
    };
    await submitCaseUseCase(message);
    expect(replaceCaseUseCase).toHaveBeenCalledWith(message);
  });
});
