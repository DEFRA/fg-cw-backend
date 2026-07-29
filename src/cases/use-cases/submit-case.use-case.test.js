import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withTransaction } from "../../common/with-transaction.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { CaseSeries } from "../models/case-series.js";
import { save } from "../repositories/case-series.repository.js";
import { newCaseUseCase } from "./new-case.use-case.js";
import { replaceCaseUseCase } from "./replace-case.use-case.js";
import { submitCaseUseCase } from "./submit-case.use-case.js";

vi.mock("../../common/with-transaction.js");
vi.mock("../../common/write-audit-event.js");
// Keep the real audit data builder but stub the shared new-case building block.
vi.mock("./new-case.use-case.js", async (importOriginal) => ({
  ...(await importOriginal()),
  newCaseUseCase: vi.fn(),
}));
vi.mock("./replace-case.use-case.js");
vi.mock("../repositories/case-series.repository.js");

describe("submitCaseUseCase", () => {
  const session = {};
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(newCaseUseCase).toHaveBeenCalledWith(message, session);
    expect(caseSeriesNewSpy).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
    expect(save.mock.calls[0][0]).toBeInstanceOf(CaseSeries);
    expect(withTransaction).toHaveBeenCalled();
  });

  it("audits a CREATE_CASE success at this level when a new case is created", async () => {
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

    expect(writeAuditEvent).toHaveBeenCalledTimes(1);
    const [auditData, auditSession] = writeAuditEvent.mock.calls[0];
    expect(auditData).toMatchObject({
      entities: [{ entity: "CASE", action: "CREATE_CASE", entityid: "1234" }],
      status: "SUCCESS",
    });
    expect(auditData.details.case).toMatchObject({
      caseRef: "1234",
      workflowCode: "foo",
      caseId: "123456789123456789123456",
    });
    // Audit is written outside the transaction (session is not forwarded here).
    expect(auditSession).toBeUndefined();
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

  it("does not double-audit the replace path (replaceCaseUseCase owns that audit)", async () => {
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
    expect(writeAuditEvent).not.toHaveBeenCalled();
  });
});
