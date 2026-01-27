import { describe, expect, it, vi } from "vitest";
import { handleCaseStatusUpdateUseCase } from "./handle-case-status-update.use-case.js";
import { progressCaseUseCase } from "./progress-case.use-case.js";

vi.mock("./progress-case.use-case.js");

describe("handleCaseStatusUpdateUseCase", () => {
  it("progresses the case to the new position", async () => {
    const message = {
      event: {
        data: {
          supplementaryData: {
            foo: "barr",
          },
        },
      },
    };

    await handleCaseStatusUpdateUseCase(message);

    expect(progressCaseUseCase).toHaveBeenCalledWith({
      supplementaryData: {
        foo: "barr",
      },
    });
  });
});
