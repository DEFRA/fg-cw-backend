import { describe, expect, it, vi } from "vitest";
import { caseExists } from "../../cases/repositories/case.repository.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { caseExistsUseCase } from "./case-exists.use-case.js";

vi.mock("../../cases/repositories/case.repository.js");
vi.mock("../../common/write-audit-event.js");

describe("caseExistsUseCase", () => {
  it.each([true, false])("answers exists: %s", async (exists) => {
    caseExists.mockResolvedValue(exists);

    expect(
      await caseExistsUseCase({ workflowCode: "frps", caseRef: "ref-1" }),
    ).toEqual({ exists });
    expect(caseExists).toHaveBeenCalledWith({
      workflowCode: "frps",
      caseRef: "ref-1",
    });
  });

  it("writes no audit event", async () => {
    caseExists.mockResolvedValue(true);

    await caseExistsUseCase({ workflowCode: "frps", caseRef: "ref-1" });

    expect(writeAuditEvent).not.toHaveBeenCalled();
  });
});
