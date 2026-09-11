import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findDetailById } from "../repositories/inbox.repository.js";
import { findHopsUseCase } from "./find-hops.use-case.js";
import { getInboxEventUseCase } from "./get-inbox-event.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../repositories/inbox.repository.js");
vi.mock("./find-hops.use-case.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";
const EVENT_ID = "evt-1";

const aDoc = () => ({
  _id: new ObjectId(ID),
  messageId: EVENT_ID,
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  status: "DEAD_LETTER",
  completionAttempts: 5,
  event: { id: "evt-1", data: { clientRef: "REF-1" } },
});

beforeEach(() => {
  findHopsUseCase.mockResolvedValue({ inbox: [], outbox: [] });
});

describe("getInboxEventUseCase", () => {
  it("reads the row by id", async () => {
    findDetailById.mockResolvedValue(aDoc());

    await getInboxEventUseCase(ID);

    expect(findDetailById).toHaveBeenCalledWith(ID);
  });

  it("maps the detail document, with this service's hops beside it", async () => {
    findDetailById.mockResolvedValue(aDoc());
    findHopsUseCase.mockResolvedValue({ inbox: [], outbox: [] });

    expect(await getInboxEventUseCase(ID)).toMatchObject({
      _id: ID,
      messageId: EVENT_ID,
      maxAttempts: 5,
      event: { id: "evt-1", data: { clientRef: "REF-1" } },
      hops: { inbox: [], outbox: [] },
      sectionErrors: [],
    });
  });

  // The hops are the rows sharing this event's id, so the search is for the id
  // the event travels under rather than the row's own Mongo `_id`.
  it("looks the hops up by the id the event travels under", async () => {
    findDetailById.mockResolvedValue(aDoc());
    findHopsUseCase.mockResolvedValue({ inbox: [], outbox: [] });

    await getInboxEventUseCase(ID);

    expect(findHopsUseCase).toHaveBeenCalledWith(EVENT_ID, expect.any(Array));
  });

  it("answers with the event and a named section error when the hops fail", async () => {
    findDetailById.mockResolvedValue(aDoc());
    findHopsUseCase.mockImplementation(async (_id, sectionErrors) => {
      sectionErrors.push({
        box: "inbox",
        section: "hops",
        message: "read failed",
      });

      return { inbox: null, outbox: [] };
    });

    const result = await getInboxEventUseCase(ID);

    expect(result.hops).toEqual({ inbox: null, outbox: [] });
    expect(result.sectionErrors).toEqual([
      { box: "inbox", section: "hops", message: "read failed" },
    ]);
  });

  it("returns the full event payload", async () => {
    findDetailById.mockResolvedValue(aDoc());

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
