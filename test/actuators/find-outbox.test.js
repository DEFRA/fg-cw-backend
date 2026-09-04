import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { findOutbox } from "../helpers/actuators.js";
import { TestUser, getTokenFor } from "../helpers/users.js";

let client;
let outbox;

const FAR_FUTURE = new Date("2099-01-01T00:00:00.000Z");
const TARGET_ARN =
  "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_status_updated_fifo.fifo";
const STATUSES = [
  "PUBLISHED",
  "PROCESSING",
  "FAILED",
  "RESUBMITTED",
  "COMPLETED",
  "DEAD_LETTER",
];

// held claims with a far-future expiry keep the outbox poller and the
// claim-expiry sweep away from the fixtures for the life of a test
const aDoc = (overrides = {}) => ({
  _id: new ObjectId(),
  event: {
    id: `evt-${new ObjectId().toHexString()}`,
    type: "cloud.defra.prd.fg-cw-backend.case.status.updated",
  },
  target: TARGET_ARN,
  segregationRef: "GLD-9B2-BWS-grasslands",
  status: "COMPLETED",
  completionAttempts: 1,
  publicationDate: new Date("2026-06-16T10:00:00.000Z"),
  lastResubmissionDate: null,
  completionDate: null,
  claimedBy: "test-holder",
  claimedAt: new Date(),
  claimExpiresAt: FAR_FUTURE,
  ...overrides,
});

const at = (minute) =>
  new Date(`2026-06-16T10:${String(minute).padStart(2, "0")}:00.000Z`);

const auditEvent = (entityid = "APPLICATION-REF-1") => ({
  datetime: "2026-06-16T10:00:03.000Z",
  version: "1",
  application: "fg-cw-backend",
  audit: {
    entities: [{ entity: "CASE", action: "VIEW_CASE_LIST", entityid }],
    accounts: [],
    status: "SUCCESS",
    details: { query: { page: 1 }, security: { user: "admin@t.gov.uk" } },
  },
});

const bodyOf = (error) => {
  const payload = error.data?.payload;

  return Buffer.isBuffer(payload)
    ? payload.toString()
    : JSON.stringify(payload);
};

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  outbox = client.db().collection("outbox");
});

afterAll(async () => {
  await client?.close(true);
});

describe("GET /actuators/outbox", () => {
  describe("auth", () => {
    it("rejects a request with no token", async () => {
      await expect(findOutbox(undefined, null)).rejects.toThrow(
        "Response Error: 401 Unauthorized",
      );
    });

    it("rejects an unknown token", async () => {
      await expect(
        findOutbox(undefined, "Bearer not-a-real-token"),
      ).rejects.toThrow("Response Error: 401 Unauthorized");
    });

    it("rejects a valid Entra user token", async () => {
      const token = await getTokenFor(TestUser.Admin.email);

      await expect(findOutbox(undefined, `Bearer ${token}`)).rejects.toThrow(
        "Response Error: 401 Unauthorized",
      );
    });

    it("answers a caller holding the seeded service token", async () => {
      const response = await findOutbox();

      expect(response.res.statusCode).toBe(200);
    });
  });

  describe("validation", () => {
    it("rejects pageSize=51 with 400", async () => {
      await expect(findOutbox({ pageSize: 51 })).rejects.toThrow(
        "Response Error: 400 Bad Request",
      );
    });

    it("rejects pageSize=0 with 400", async () => {
      await expect(findOutbox({ pageSize: 0 })).rejects.toThrow(
        "Response Error: 400 Bad Request",
      );
    });

    it("rejects direction=sideways with 400", async () => {
      await expect(findOutbox({ direction: "sideways" })).rejects.toThrow(
        "Response Error: 400 Bad Request",
      );
    });

    it("rejects status=BOGUS with 400", async () => {
      await expect(findOutbox({ status: "BOGUS" })).rejects.toThrow(
        "Response Error: 400 Bad Request",
      );
    });

    it("rejects a tampered cursor with 400", async () => {
      const error = await findOutbox({ cursor: "not-a-cursor" }).catch(
        (e) => e,
      );

      expect(error.output.statusCode).toBe(400);
      expect(bodyOf(error)).toMatch(/Cannot decode cursor/);
    });
  });

  describe("empty collection", () => {
    it("returns an empty page with null cursors", async () => {
      const { payload } = await findOutbox();

      expect(payload.data).toEqual([]);
      expect(payload.pagination.startCursor).toBeNull();
      expect(payload.pagination.endCursor).toBeNull();
      expect(payload.pagination.hasNextPage).toBe(false);
      expect(payload.pagination.hasPreviousPage).toBe(false);
    });
  });

  describe("listing", () => {
    beforeEach(async () => {
      await outbox.insertMany([
        aDoc({ event: { id: "oldest" }, publicationDate: at(0) }),
        aDoc({ event: { id: "middle" }, publicationDate: at(1) }),
        aDoc({ event: { id: "newest" }, publicationDate: at(2) }),
      ]);
    });

    it("returns events newest first by publicationDate", async () => {
      const { payload } = await findOutbox();

      expect(payload.data.map((r) => r.eventId)).toEqual([
        "newest",
        "middle",
        "oldest",
      ]);
    });

    it("serialises publicationDate as an ISO string", async () => {
      const { payload } = await findOutbox();

      expect(payload.data[0].createdAt).toBe("2026-06-16T10:02:00.000Z");
    });

    it("returns the raw SNS target ARN", async () => {
      const { payload } = await findOutbox();

      expect(payload.data[0].target).toBe(TARGET_ARN);
    });

    it("stamps maxAttempts from CW's OUTBOX_MAX_RETRIES on every row", async () => {
      const { payload } = await findOutbox();

      for (const row of payload.data) {
        expect(row.maxAttempts).toBe(5);
      }
    });

    // NOTE - this file is port-blocked locally and is not run by the local
    // gates; it is updated in step with the unit tests it mirrors.
    it("returns no kind and no auditEntities field", async () => {
      const { payload } = await findOutbox();

      expect(payload.data[0]).not.toHaveProperty("kind");
      expect(payload.data[0]).not.toHaveProperty("auditEntities");
    });

    it("omits totalCount from pagination", async () => {
      const { payload } = await findOutbox();

      expect(payload.pagination).not.toHaveProperty("totalCount");
    });
  });

  describe("tie-breaking", () => {
    it("breaks ties on _id descending", async () => {
      const lower = new ObjectId("665f1c2e9a1b2c3d4e5f6b01");
      const higher = new ObjectId("665f1c2e9a1b2c3d4e5f6b02");

      await outbox.insertMany([
        aDoc({ _id: lower, event: { id: "lower" }, publicationDate: at(0) }),
        aDoc({ _id: higher, event: { id: "higher" }, publicationDate: at(0) }),
      ]);

      const { payload } = await findOutbox();

      expect(payload.data.map((r) => r.eventId)).toEqual(["higher", "lower"]);
    });
  });

  describe("paging", () => {
    beforeEach(async () => {
      await outbox.insertMany(
        Array.from({ length: 25 }, (_, i) =>
          aDoc({ event: { id: `evt-${i}` }, publicationDate: at(i) }),
        ),
      );
    });

    it("returns at most pageSize rows", async () => {
      const { payload } = await findOutbox({ pageSize: 10 });

      expect(payload.data).toHaveLength(10);
      expect(payload.pagination.hasNextPage).toBe(true);
      expect(payload.pagination.hasPreviousPage).toBe(false);
    });

    it("defaults to 20 rows when pageSize is omitted", async () => {
      const { payload } = await findOutbox();

      expect(payload.data).toHaveLength(20);
      expect(payload.pagination.hasNextPage).toBe(true);
    });

    it("does not duplicate or skip a row when a newer row is inserted between pages", async () => {
      const first = await findOutbox({ pageSize: 5 });

      // a row newer than everything seeded, written after page 1 was served
      await outbox.insertOne(
        aDoc({ event: { id: "interloper" }, publicationDate: at(59) }),
      );

      const second = await findOutbox({
        pageSize: 5,
        cursor: first.payload.pagination.endCursor,
        direction: "forward",
      });

      const firstIds = first.payload.data.map((r) => r.eventId);
      const secondIds = second.payload.data.map((r) => r.eventId);

      expect(firstIds).toEqual([
        "evt-24",
        "evt-23",
        "evt-22",
        "evt-21",
        "evt-20",
      ]);
      expect(secondIds).toEqual([
        "evt-19",
        "evt-18",
        "evt-17",
        "evt-16",
        "evt-15",
      ]);
      expect(secondIds).not.toContain("interloper");
      expect(new Set([...firstIds, ...secondIds]).size).toBe(10);
    });

    it("walks forward and back without duplicating or skipping a row", async () => {
      const first = await findOutbox({ pageSize: 5 });

      const second = await findOutbox({
        pageSize: 5,
        cursor: first.payload.pagination.endCursor,
        direction: "forward",
      });

      const backAgain = await findOutbox({
        pageSize: 5,
        cursor: second.payload.pagination.startCursor,
        direction: "backward",
      });

      const ids = (r) => r.payload.data.map((row) => row.eventId);

      expect(ids(second)).not.toEqual(expect.arrayContaining(ids(first)));
      expect(ids(backAgain)).toEqual(ids(first));
    });
  });

  describe("filtering", () => {
    beforeEach(async () => {
      await outbox.insertMany(
        STATUSES.map((status, i) =>
          aDoc({ event: { id: status }, status, publicationDate: at(i) }),
        ),
      );
    });

    it("returns every status when no status is given", async () => {
      const { payload } = await findOutbox();

      expect(payload.data.map((r) => r.status).sort()).toEqual(
        [...STATUSES].sort(),
      );
    });

    it("returns only matching rows when status is given", async () => {
      const { payload } = await findOutbox({ status: "DEAD_LETTER" });

      expect(payload.data).toHaveLength(1);
      expect(payload.data[0].status).toBe("DEAD_LETTER");
    });
  });

  // An audit record is not a CloudEvent: it stores no id and no type, so both
  // are null. Nothing else about its audit-ness reaches the wire - the audit
  // entities are not projected and not returned.
  describe("audit rows", () => {
    it("maps a CloudEvent row to eventId and type", async () => {
      await outbox.insertOne(aDoc({ event: { id: "evt-1", type: "a.b.c" } }));

      const { payload } = await findOutbox();

      expect(payload.data[0].eventId).toBe("evt-1");
      expect(payload.data[0].type).toBe("a.b.c");
      expect(payload.data[0]).not.toHaveProperty("auditEntities");
    });

    it("maps an audit row to a null eventId and a null type", async () => {
      await outbox.insertOne(aDoc({ event: auditEvent() }));

      const { payload } = await findOutbox();

      expect(payload.data[0].eventId).toBeNull();
      expect(payload.data[0].type).toBeNull();
      expect(payload.data[0]).not.toHaveProperty("auditEntities");
    });

    it("never leaks an audit entity, its entityid or its details", async () => {
      await outbox.insertOne(aDoc({ event: auditEvent() }));

      const { payload } = await findOutbox();

      expect(payload.data).toHaveLength(1);
      expect(JSON.stringify(payload)).not.toMatch(
        /entityid|details|APPLICATION-REF-1|VIEW_CASE_LIST/,
      );
    });

    it("returns an audit row with an empty entities array like any other", async () => {
      await outbox.insertOne(
        aDoc({ event: { audit: { entities: [], status: "SUCCESS" } } }),
      );

      const { payload } = await findOutbox();

      expect(payload.data[0].type).toBeNull();
      expect(payload.data[0]).not.toHaveProperty("auditEntities");
    });
  });

  describe("traceparent", () => {
    it("lifts event.traceparent to a top-level traceparent", async () => {
      await outbox.insertOne(
        aDoc({
          event: {
            id: "evt-traced",
            type: "a.b.c",
            traceparent:
              "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
          },
        }),
      );

      const { payload } = await findOutbox();

      expect(payload.data[0].traceparent).toBe(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      );
    });

    it("returns null for an audit row and never its correlationid", async () => {
      await outbox.insertOne(
        aDoc({
          event: {
            ...auditEvent(),
            correlationid: "d0f7b2a4-1111-2222-3333-444455556666",
          },
        }),
      );

      const { payload } = await findOutbox();

      expect(payload.data[0].traceparent).toBeNull();
      expect(JSON.stringify(payload)).not.toMatch(/d0f7b2a4|correlationid/);
    });

    it("returns null when the CloudEvent carries no traceparent", async () => {
      await outbox.insertOne(aDoc());

      const { payload } = await findOutbox();

      expect(payload.data[0].traceparent).toBeNull();
    });
  });

  describe("leakage", () => {
    it("never returns event, event.data or claimedBy", async () => {
      await outbox.insertOne(
        aDoc({
          claimedBy: "worker-1",
          event: {
            id: "evt-1",
            type: "a.b.c",
            data: { clientRef: "APPLICATION-REF-1", sbi: "123456789" },
          },
        }),
      );

      const { payload } = await findOutbox();

      expect(payload.data).toHaveLength(1);
      expect(JSON.stringify(payload)).not.toMatch(
        /claimedBy|"event"|APPLICATION-REF-1|123456789/,
      );
    });

    it("returns the traceparent and nothing else from a payload-carrying event", async () => {
      await outbox.insertOne(
        aDoc({
          claimedBy: "worker-1",
          event: {
            id: "evt-1",
            type: "a.b.c",
            traceparent:
              "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
            source: "fg-cw-backend",
            subject: "SECRET-SUBJECT",
            data: { clientRef: "APPLICATION-REF-1", sbi: "123456789" },
          },
        }),
      );

      const { payload } = await findOutbox();

      expect(payload.data[0].traceparent).toBe(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      );
      expect(JSON.stringify(payload)).not.toMatch(
        /"event"|SECRET-SUBJECT|APPLICATION-REF-1|123456789|fg-cw-backend/,
      );
    });
  });
});

// NOTE: this file cannot be run on this machine - the integration stack's
// ports clash with the services already running locally - so the cases below
// are written to the same contract as the unit tests but are unexercised here.
const AUDIT_TOPIC_ARN =
  "arn:aws:sns:eu-west-2:000000000000:cw__sns__audit_topic_arn";

describe("GET /actuators/outbox?q=", () => {
  beforeEach(async () => {
    await outbox.insertMany([
      aDoc({
        event: { id: "evt-alpha", type: "cloud.defra.prd.x.y" },
        segregationRef: "GLD-9B2-BWS-alpha",
        publicationDate: at(0),
      }),
      aDoc({
        event: { id: "evt-beta", type: "cloud.defra.prd.x.y" },
        segregationRef: "SFI-1A1-XYZ-beta",
        publicationDate: at(1),
      }),
    ]);
  });

  it("matches an event.id exactly", async () => {
    const { payload } = await findOutbox({ q: "evt-alpha" });

    expect(payload.data.map((r) => r.eventId)).toEqual(["evt-alpha"]);
  });

  it("matches a segregationRef prefix case-insensitively", async () => {
    const { payload } = await findOutbox({ q: "gld-9b2" });

    expect(payload.data.map((r) => r.eventId)).toEqual(["evt-alpha"]);
  });

  it("matches a row on its 24-hex _id", async () => {
    const id = new ObjectId();
    await outbox.insertOne(
      aDoc({
        _id: id,
        event: { id: "evt-by-id", type: "cloud.defra.prd.x.y" },
      }),
    );

    const { payload } = await findOutbox({ q: id.toHexString() });

    expect(payload.data.map((r) => r._id)).toEqual([id.toHexString()]);
  });

  it("returns an empty page for a q that matches nothing", async () => {
    const { payload } = await findOutbox({ q: "nonexistent-ref" });

    expect(payload.data).toEqual([]);
  });

  it("treats regex metacharacters in q as literal text", async () => {
    const { payload } = await findOutbox({ q: ".*" });

    expect(payload.data).toEqual([]);
  });

  it("matches a segregationRef that itself contains metacharacters", async () => {
    await outbox.insertOne(
      aDoc({
        event: { id: "evt-meta", type: "cloud.defra.prd.x.y" },
        segregationRef: "GLD.9B2+BWS",
      }),
    );

    const { payload } = await findOutbox({ q: "GLD.9B2+" });

    expect(payload.data.map((r) => r.segregationRef)).toEqual(["GLD.9B2+BWS"]);
  });

  it("treats a whitespace-only q as absent", async () => {
    const { payload } = await findOutbox({ q: "   " });

    expect(payload.data).toHaveLength(2);
  });

  it("rejects a q longer than 200 characters with 400", async () => {
    await expect(findOutbox({ q: "a".repeat(201) })).rejects.toThrow(
      "Response Error: 400 Bad Request",
    );
  });
});

// The TYPE (domain/audit) filter is GONE. `kind` is not a known parameter any
// more, so a stale caller gets a 400 rather than a silently unfiltered page.
// Audit rows appear in the list inline with every other row.
describe("GET /actuators/outbox and audit rows", () => {
  // both audit shapes the outbox actually stores: an `audit` payload, and a
  // row addressed to this service's own audit topic
  beforeEach(async () => {
    await outbox.insertMany([
      aDoc({
        event: { id: "evt-domain", type: "cloud.defra.prd.x.y" },
        publicationDate: at(0),
      }),
      aDoc({ event: auditEvent(), publicationDate: at(1) }),
      aDoc({
        event: { id: "evt-audit-target", type: "cloud.defra.prd.x.y" },
        target: AUDIT_TOPIC_ARN,
        publicationDate: at(2),
      }),
    ]);
  });

  it("returns all three rows on one unfiltered page", async () => {
    const { payload } = await findOutbox();

    expect(payload.data).toHaveLength(3);
    expect(payload.data.map((r) => r.eventId)).toContain("evt-domain");
    expect(payload.data.map((r) => r.eventId)).toContain("evt-audit-target");
  });

  it("returns a null type only for the row that stores none", async () => {
    const { payload } = await findOutbox();
    const nullTyped = payload.data.filter((r) => r.type === null);

    expect(nullTyped).toHaveLength(1);
    expect(nullTyped[0].eventId).toBeNull();
  });

  // The audit TOPIC says nothing about a row's type: a row on that topic that
  // does carry a CloudEvent type keeps it.
  it("keeps the stored type on a row addressed at the audit topic", async () => {
    const { payload } = await findOutbox();
    const [row] = payload.data.filter((r) => r.eventId === "evt-audit-target");

    expect(row.type).toBe("cloud.defra.prd.x.y");
  });

  it.each([["audit"], ["domain"], ["other"], [""]])(
    "rejects kind=%s with 400 - it is not a parameter any more",
    async (kind) => {
      await expect(findOutbox({ kind })).rejects.toThrow(
        "Response Error: 400 Bad Request",
      );
    },
  );
});

describe("GET /actuators/outbox lastError", () => {
  it("returns null lastError for a row written before the field existed", async () => {
    await outbox.insertOne(aDoc());

    const { payload } = await findOutbox();

    expect(payload.data[0].lastError).toBeNull();
  });

  it("surfaces a stored lastError", async () => {
    const lastError = {
      name: "ClaimExpired",
      message: "claim expired before completion",
      at: "2026-06-16T10:16:05.000Z",
    };
    await outbox.insertOne(aDoc({ status: "DEAD_LETTER", lastError }));

    const { payload } = await findOutbox();

    expect(payload.data[0].lastError).toEqual(lastError);
  });

  it("never returns a stack stored alongside a lastError", async () => {
    await outbox.insertOne(
      aDoc({
        status: "DEAD_LETTER",
        lastError: {
          name: "Error",
          message: "boom",
          at: "2026-06-16T10:16:05.000Z",
          stack: "SECRET-STACK",
        },
      }),
    );

    const { payload } = await findOutbox();

    expect(JSON.stringify(payload)).not.toContain("SECRET-STACK");
  });
});
