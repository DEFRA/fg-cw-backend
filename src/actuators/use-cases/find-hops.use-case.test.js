import { beforeEach, describe, expect, it, vi } from "vitest";
import { findHopsUseCase } from "./find-hops.use-case.js";
import { findInboxPageUseCase } from "./find-inbox-page.use-case.js";
import { findOutboxPageUseCase } from "./find-outbox-page.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("./find-inbox-page.use-case.js");
vi.mock("./find-outbox-page.use-case.js");

const EVENT_ID = "3f2c1a0e-0000-4000-8000-000000000000";

const aRow = (box) => ({ _id: `665f1c2e9a1b2c3d4e5f6a7${box}` });

const givenBothBoxesAnswer = () => {
  findInboxPageUseCase.mockResolvedValue({ data: [aRow("b")] });
  findOutboxPageUseCase.mockResolvedValue({ data: [aRow("c")] });
};

describe("findHopsUseCase", () => {
  beforeEach(givenBothBoxesAnswer);

  it("answers with both boxes' rows for one event id", async () => {
    const hops = await findHopsUseCase(EVENT_ID, []);

    expect(hops).toEqual({ inbox: [aRow("b")], outbox: [aRow("c")] });
  });

  // The same free-text search the list takes, which matches an event id
  // exactly against each box's own id field.
  it("searches both boxes by the event's id", async () => {
    await findHopsUseCase(EVENT_ID, []);

    expect(findInboxPageUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ q: EVENT_ID }),
    );
    expect(findOutboxPageUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ q: EVENT_ID }),
    );
  });

  it("asks for the audit records a list leaves out", async () => {
    await findHopsUseCase(EVENT_ID, []);

    expect(findInboxPageUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ audit: "include" }),
    );
  });

  it("reads a page of hops a box, not the whole box", async () => {
    await findHopsUseCase(EVENT_ID, []);

    expect(findOutboxPageUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 20, direction: "forward" }),
    );
  });

  it("nulls a box that could not be read and names it", async () => {
    findOutboxPageUseCase.mockRejectedValue(new Error("boom"));
    const sectionErrors = [];

    const hops = await findHopsUseCase(EVENT_ID, sectionErrors);

    expect(hops).toEqual({ inbox: [aRow("b")], outbox: null });
    expect(sectionErrors).toEqual([
      { box: "outbox", section: "hops", message: "read failed" },
    ]);
  });

  it("answers with an empty box rather than a null when there is nothing", async () => {
    findInboxPageUseCase.mockResolvedValue({ data: [] });
    const sectionErrors = [];

    const hops = await findHopsUseCase(EVENT_ID, sectionErrors);

    expect(hops.inbox).toEqual([]);
    expect(sectionErrors).toEqual([]);
  });
});
