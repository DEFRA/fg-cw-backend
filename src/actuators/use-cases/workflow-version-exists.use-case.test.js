import { describe, expect, it, vi } from "vitest";
import { configVersionExists } from "../../cases/repositories/config-version.repository.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { workflowVersionExistsUseCase } from "./workflow-version-exists.use-case.js";

vi.mock("../../cases/repositories/config-version.repository.js");
vi.mock("../../common/write-audit-event.js");

describe("workflowVersionExistsUseCase", () => {
  it.each([true, false])("answers exists: %s", async (exists) => {
    configVersionExists.mockResolvedValue(exists);

    expect(
      await workflowVersionExistsUseCase({
        code: "woodland",
        version: "1.2.0",
      }),
    ).toEqual({ exists });
    expect(configVersionExists).toHaveBeenCalledWith({
      grantCode: "woodland",
      version: "1.2.0",
    });
  });

  it("writes no audit event", async () => {
    configVersionExists.mockResolvedValue(true);

    await workflowVersionExistsUseCase({ code: "woodland", version: "1.2.0" });

    expect(writeAuditEvent).not.toHaveBeenCalled();
  });
});
