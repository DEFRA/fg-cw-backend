import { describe, expect, it, vi } from "vitest";
import { caseExists } from "../../cases/repositories/case.repository.js";
import { findEventCaseUseCase } from "./find-event-case.use-case.js";

vi.mock("../../cases/repositories/case.repository.js");

describe("findEventCaseUseCase", () => {
  it("checks the case named by the event's caseRef and workflowCode", async () => {
    caseExists.mockResolvedValue(true);

    const result = await findEventCaseUseCase({
      data: {
        caseRef: "ref-1",
        workflowCode: "frps-private-beta",
        payload: { caseRef: "other" },
      },
    });

    expect(result).toEqual({
      workflowCode: "frps-private-beta",
      caseRef: "ref-1",
      exists: true,
    });
    expect(caseExists).toHaveBeenCalledWith({
      workflowCode: "frps-private-beta",
      caseRef: "ref-1",
    });
  });

  it("says when the case does not exist", async () => {
    caseExists.mockResolvedValue(false);

    expect(
      await findEventCaseUseCase({
        data: { caseRef: "ref-1", workflowCode: "frps" },
      }),
    ).toMatchObject({ exists: false });
  });

  it.each([
    ["no event", undefined],
    ["no data", {}],
    ["only a clientRef", { data: { clientRef: "ref-1", code: "frps" } }],
    ["no workflowCode", { data: { caseRef: "ref-1" } }],
    ["a non-string caseRef", { data: { caseRef: 7, workflowCode: "frps" } }],
  ])("answers null for %s, without a read", async (_name, event) => {
    expect(await findEventCaseUseCase(event)).toBeNull();
    expect(caseExists).not.toHaveBeenCalled();
  });
});
