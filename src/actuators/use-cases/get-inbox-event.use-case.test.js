import { beforeEach, describe, expect, it, vi } from "vitest";
import { findDetailById } from "../../cases/repositories/inbox.repository.js";
import { findEventCaseUseCase } from "./find-event-case.use-case.js";
import { getInboxEventUseCase } from "./get-inbox-event.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../cases/repositories/inbox.repository.js");
vi.mock("./find-event-case.use-case.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";
const EVENT_ID = "evt-1";

const aDetail = () => ({
  _id: ID,
  messageId: EVENT_ID,
  status: "DEAD_LETTER",
  completionAttempts: 5,
  maxAttempts: 5,
  event: { id: "evt-1", data: { clientRef: "REF-1" } },
});

beforeEach(() => {
  findEventCaseUseCase.mockResolvedValue(null);
});

describe("getInboxEventUseCase", () => {
  it("reads the row by id", async () => {
    findDetailById.mockResolvedValue(aDetail());

    await getInboxEventUseCase(ID);

    expect(findDetailById).toHaveBeenCalledWith(ID);
  });

  it("returns the detail document whole", async () => {
    const detail = aDetail();
    findDetailById.mockResolvedValue(detail);

    expect(await getInboxEventUseCase(ID)).toEqual({ ...detail, case: null });
  });

  it("adds the case the event names, and whether it exists", async () => {
    const detail = aDetail();
    const kase = { workflowCode: "frps", caseRef: "ref-1", exists: false };
    findDetailById.mockResolvedValue(detail);
    findEventCaseUseCase.mockResolvedValue(kase);

    expect(await getInboxEventUseCase(ID)).toEqual({ ...detail, case: kase });
    expect(findEventCaseUseCase).toHaveBeenCalledWith(detail.event);
  });

  it("returns the full event payload", async () => {
    findDetailById.mockResolvedValue(aDetail());

    const result = await getInboxEventUseCase(ID);

    expect(result.event).toEqual({ id: "evt-1", data: { clientRef: "REF-1" } });
  });

  it("404s when there is no such row", async () => {
    findDetailById.mockResolvedValue(null);

    await expect(getInboxEventUseCase(ID)).rejects.toMatchObject({
      output: { statusCode: 404 },
    });
  });

  it("names the id in the 404", async () => {
    findDetailById.mockResolvedValue(null);

    await expect(getInboxEventUseCase(ID)).rejects.toThrow(ID);
  });
});
