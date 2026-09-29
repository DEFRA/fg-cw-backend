import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EDIT_PAYLOAD_MAX_BYTES,
  editPayloadRequest,
  failEditValidation,
} from "../schemas/edit-payload.schema.js";
import { editInboxEventPayloadUseCase } from "../use-cases/edit-inbox-event-payload.use-case.js";
import { editOutboxEventPayloadUseCase } from "../use-cases/edit-outbox-event-payload.use-case.js";
import {
  editEventPayloadRoute,
  editInboxEventPayloadRoute,
  editOutboxEventPayloadRoute,
} from "./edit-event-payload.route.js";

vi.mock("../use-cases/edit-inbox-event-payload.use-case.js");
vi.mock("../use-cases/edit-outbox-event-payload.use-case.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";

const useCase = vi.fn();
const route = editEventPayloadRoute({ box: "inbox", useCase });
const { options } = route;

const aBody = (overrides = {}) => ({
  payload: { id: "evt-1", data: { amount: 12 } },
  note: "amount was a string",
  revision: 0,
  ...overrides,
});

const handle = async (request = {}) =>
  route.handler({
    params: { id: ID },
    query: { by: "donatas" },
    payload: aBody(),
    auth: { credentials: { service: "fg-gas-backend" } },
    ...request,
  });

beforeEach(() => {
  useCase.mockResolvedValue({
    payloadRevision: 1,
    changedPaths: ["/data/amount"],
    changedPathsTruncated: false,
    beforeHash: "before",
    afterHash: "after",
  });
});

describe("editEventPayloadRoute", () => {
  it("is a POST on the box's payload path", () => {
    expect(route.method).toBe("POST");
    expect(route.path).toBe("/actuators/events/inbox/{id}/payload");
  });

  it("names the box in its description", () => {
    expect(options.description).toContain("DEAD_LETTER or PURGED inbox event");
  });

  it("is on the public-api strategy, tagged for the public API", () => {
    expect(options.auth).toBe("public-api");
    expect(options.tags).toEqual(["api", "public-api"]);
  });

  it("rejects an id that is not a 24-hex ObjectId", () => {
    expect(
      options.validate.params.validate({ id: "../../etc" }).error,
    ).toBeDefined();
  });

  it("validates the body against the shared edit schema", () => {
    expect(options.validate.payload).toBe(editPayloadRequest);
  });

  it("logs a refused body without quoting it", () => {
    expect(options.validate.failAction).toBe(failEditValidation);
  });

  it("takes a body big enough for a payload at the bound", () => {
    expect(options.payload.maxBytes).toBe(EDIT_PAYLOAD_MAX_BYTES);
  });

  // An edit is audited under the operator's name, so it cannot be anonymous.
  it("requires an operator, and a blank one is a missing one", () => {
    const validateQuery = (query) => options.validate.query.validate(query);

    expect(validateQuery({}).error).toBeDefined();
    expect(validateQuery({ by: "   " }).error).toBeDefined();
    expect(validateQuery({ by: "ada" }).error).toBeUndefined();
  });

  it("passes the id, the operator, the caller and the body to the use case", async () => {
    await handle();

    expect(useCase).toHaveBeenCalledWith({
      id: ID,
      by: "donatas",
      caller: "fg-gas-backend",
      payload: { id: "evt-1", data: { amount: 12 } },
      note: "amount was a string",
      revision: 0,
    });
  });

  it("records no caller when the request carries no service credentials", async () => {
    await handle({ auth: {} });

    expect(useCase).toHaveBeenCalledWith(
      expect.objectContaining({ caller: null }),
    );
  });

  // The hashes are for the audit event; the caller gets the revision to post
  // next time and where the edit landed.
  it("answers the new revision and the changed paths, not the hashes", async () => {
    expect(await handle()).toEqual({
      payloadRevision: 1,
      changedPaths: ["/data/amount"],
      changedPathsTruncated: false,
    });
  });

  it("describes its answer with the response schema", async () => {
    expect(
      options.response.schema.validate(await handle()).error,
    ).toBeUndefined();
  });
});

describe.each([
  ["inbox", editInboxEventPayloadRoute, editInboxEventPayloadUseCase],
  ["outbox", editOutboxEventPayloadRoute, editOutboxEventPayloadUseCase],
])("the %s payload edit route", (box, boxRoute, boxUseCase) => {
  it(`is a POST on /actuators/events/${box}/{id}/payload`, () => {
    expect(boxRoute.method).toBe("POST");
    expect(boxRoute.path).toBe(`/actuators/events/${box}/{id}/payload`);
  });

  it(`hands the edit to the ${box} use case`, async () => {
    boxUseCase.mockResolvedValue({
      payloadRevision: 1,
      changedPaths: [],
      changedPathsTruncated: false,
    });

    await boxRoute.handler({
      params: { id: ID },
      query: { by: "donatas" },
      payload: { payload: { id: "evt-1" }, note: "n", revision: 0 },
      auth: {},
    });

    expect(boxUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ id: ID, by: "donatas" }),
    );
  });
});
