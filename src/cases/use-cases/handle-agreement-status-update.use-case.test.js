import { describe, expect, it, vi } from "vitest";
import { handleAgreementStatusUpdateUseCase } from "./handle-agreement-status-update.use-case.js";
import { updateSupplementaryDataUseCase } from "./update-supplementary-data.use-case.js";

vi.mock("./update-supplementary-data.use-case.js");

describe("handleAgreementStatusUpdateUseCase", () => {
  it("should call updateSupplementaryDataUseCase", async () => {
    const data = {
      supplementaryData: {
        foo: "barr",
      },
    };
    await handleAgreementStatusUpdateUseCase(data);
    expect(updateSupplementaryDataUseCase).toHaveBeenCalled();
  });
});
