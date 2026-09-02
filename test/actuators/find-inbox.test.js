import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { findInbox } from "../helpers/actuators.js";
import { TestUser, getTokenFor } from "../helpers/users.js";

let client;
let inbox;

const FAR_FUTURE = new Date("2099-01-01T00:00:00.000Z");
const STATUSES = [
  "PUBLISHED",
  "PROCESSING",
  "FAILED",
  "RESUBMITTED",
  "COMPLETED",
  "DEAD_LETTER",
];

// held claims with a far-future expiry keep the inbox poller and the
// claim-expiry sweep away from the fixtures for the life of a test
const aDoc = (overrides = {}) => ({
  _id: new ObjectId(),
  messageId: `msg-${new ObjectId().toHexString()}`,
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  source: "GAS",
  segregationRef: "GLD-9B2-BWS-grasslands",
  status: "COMPLETED",
  completionAttempts: 1,
  eventTime: "2026-06-16T10:00:00.000Z",
  lastResubmissionDate: null,
  completionDate: null,
  claimedBy: "test-holder",
  claimedAt: new Date(),
  claimExpiresAt: FAR_FUTURE,
  event: { id: "evt-1", time: "2026-06-16T10:00:00.000Z" },
  ...overrides,
});

const at = (minute) =>
  `2026-06-16T10:${String(minute).padStart(2, "0")}:00.000Z`;

const bodyOf = (error) => {
  const payload = error.data?.payload;

  return Buffer.isBuffer(payload)
    ? payload.toString()
    : JSON.stringify(payload);
};

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  inbox = client.db().collection("inbox");
});

afterAll(async () => {
  await client?.close(true);
});

describe("GET /actuators/inbox", () => {
  describe("auth", () => {
    it("rejects a request with no token", async () => {
      await expect(findInbox(undefined, null)).rejects.toThrow(
        "Response Error: 401 Unauthorized",
      );
    });

    it("rejects an unknown token", async () => {
      await expect(
        findInbox(undefined, "Bearer not-a-real-token"),
      ).rejects.toThrow("Response Error: 401 Unauthorized");
    });

    it("rejects a valid Entra user token", async () => {
      const token = await getTokenFor(TestUser.Admin.email);

      await expect(findInbox(undefined, `Bearer ${token}`)).rejects.toThrow(
        "Response Error: 401 Unauthorized",
      );
    });

    it("answers a caller holding the seeded service token", async () => {
      const response = await findInbox();

      expect(response.res.statusCode).toBe(200);
    });
  });

  describe("validation", () => {
    it("rejects pageSize=51 with 400", async () => {
      await expect(findInbox({ pageSize: 51 })).rejects.toThrow(
        "Response Error: 400 Bad Request",
      );
    });

    it("rejects pageSize=0 with 400", async () => {
      await expect(findInbox({ pageSize: 0 })).rejects.toThrow(
        "Response Error: 400 Bad Request",
      );
    });

    it("rejects direction=sideways with 400", async () => {
      await expect(findInbox({ direction: "sideways" })).rejects.toThrow(
        "Response Error: 400 Bad Request",
      );
    });

    it("rejects status=BOGUS with 400", async () => {
      await expect(findInbox({ status: "BOGUS" })).rejects.toThrow(
        "Response Error: 400 Bad Request",
      );
    });

    it("rejects a tampered cursor with 400", async () => {
      const error = await findInbox({ cursor: "not-a-cursor" }).catch((e) => e);

      expect(error.output.statusCode).toBe(400);
      expect(bodyOf(error)).toMatch(/Cannot decode cursor/);
    });
  });

  describe("empty collection", () => {
    it("returns an empty page with null cursors", async () => {
      const { payload } = await findInbox();

      expect(payload.data).toEqual([]);
      expect(payload.pagination.startCursor).toBeNull();
      expect(payload.pagination.endCursor).toBeNull();
      expect(payload.pagination.hasNextPage).toBe(false);
      expect(payload.pagination.hasPreviousPage).toBe(false);
    });
  });

  describe("listing", () => {
    beforeEach(async () => {
      await inbox.insertMany([
        aDoc({ messageId: "oldest", eventTime: at(0) }),
        aDoc({ messageId: "middle", eventTime: at(1) }),
        aDoc({ messageId: "newest", eventTime: at(2) }),
      ]);
    });

    it("returns events newest first by eventTime", async () => {
      const { payload } = await findInbox();

      expect(payload.data.map((r) => r.eventId)).toEqual([
        "newest",
        "middle",
        "oldest",
      ]);
    });

    it("exposes source, messageId as eventId and the top-level type", async () => {
      const { payload } = await findInbox();
      const row = payload.data[0];

      expect(row.source).toBe("GAS");
      expect(row.eventId).toBe("newest");
      expect(row.type).toBe("cloud.defra.prd.fg-gas-backend.case.create.new");
      expect(row.segregationRef).toBe("GLD-9B2-BWS-grasslands");
      expect(row.createdAt).toBe(at(2));
    });

    it("stamps maxAttempts from CW's INBOX_MAX_RETRIES on every row", async () => {
      const { payload } = await findInbox();

      for (const row of payload.data) {
        expect(row.maxAttempts).toBe(5);
      }
    });

    it("returns no kind field", async () => {
      const { payload } = await findInbox();

      expect(payload.data[0]).not.toHaveProperty("kind");
    });

    it("omits totalCount from pagination", async () => {
      const { payload } = await findInbox();

      expect(payload.pagination).not.toHaveProperty("totalCount");
    });
  });

  describe("tie-breaking", () => {
    it("breaks ties on _id descending", async () => {
      const lower = new ObjectId("665f1c2e9a1b2c3d4e5f6a01");
      const higher = new ObjectId("665f1c2e9a1b2c3d4e5f6a02");

      await inbox.insertMany([
        aDoc({ _id: lower, messageId: "lower", eventTime: at(0) }),
        aDoc({ _id: higher, messageId: "higher", eventTime: at(0) }),
      ]);

      const { payload } = await findInbox();

      expect(payload.data.map((r) => r.eventId)).toEqual(["higher", "lower"]);
    });
  });

  describe("paging", () => {
    beforeEach(async () => {
      await inbox.insertMany(
        Array.from({ length: 25 }, (_, i) =>
          aDoc({ messageId: `msg-${i}`, eventTime: at(i) }),
        ),
      );
    });

    it("returns at most pageSize rows", async () => {
      const { payload } = await findInbox({ pageSize: 10 });

      expect(payload.data).toHaveLength(10);
      expect(payload.pagination.hasNextPage).toBe(true);
      expect(payload.pagination.hasPreviousPage).toBe(false);
    });

    it("defaults to 20 rows when pageSize is omitted", async () => {
      const { payload } = await findInbox();

      expect(payload.data).toHaveLength(20);
      expect(payload.pagination.hasNextPage).toBe(true);
    });

    it("does not duplicate or skip a row when a newer row is inserted between pages", async () => {
      const first = await findInbox({ pageSize: 5 });

      // a row newer than everything seeded, written after page 1 was served
      await inbox.insertOne(
        aDoc({ messageId: "interloper", eventTime: at(59) }),
      );

      const second = await findInbox({
        pageSize: 5,
        cursor: first.payload.pagination.endCursor,
        direction: "forward",
      });

      const firstIds = first.payload.data.map((r) => r.eventId);
      const secondIds = second.payload.data.map((r) => r.eventId);

      expect(firstIds).toEqual([
        "msg-24",
        "msg-23",
        "msg-22",
        "msg-21",
        "msg-20",
      ]);
      expect(secondIds).toEqual([
        "msg-19",
        "msg-18",
        "msg-17",
        "msg-16",
        "msg-15",
      ]);
      expect(secondIds).not.toContain("interloper");
      expect(new Set([...firstIds, ...secondIds]).size).toBe(10);
    });

    it("walks forward and back without duplicating or skipping a row", async () => {
      const first = await findInbox({ pageSize: 5 });

      const second = await findInbox({
        pageSize: 5,
        cursor: first.payload.pagination.endCursor,
        direction: "forward",
      });

      const backAgain = await findInbox({
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
      await inbox.insertMany(
        STATUSES.map((status, i) =>
          aDoc({ messageId: status, status, eventTime: at(i) }),
        ),
      );
    });

    it("returns every status when no status is given", async () => {
      const { payload } = await findInbox();

      expect(payload.data.map((r) => r.status).sort()).toEqual(
        [...STATUSES].sort(),
      );
    });

    it("returns only matching rows when status is given", async () => {
      const { payload } = await findInbox({ status: "DEAD_LETTER" });

      expect(payload.data).toHaveLength(1);
      expect(payload.data[0].status).toBe("DEAD_LETTER");
    });
  });

  describe("traceparent", () => {
    it("returns the document's W3C traceparent", async () => {
      await inbox.insertOne(
        aDoc({
          traceparent:
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        }),
      );

      const { payload } = await findInbox();

      expect(payload.data[0].traceparent).toBe(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      );
    });

    it("returns a bare CDP request id unchanged", async () => {
      await inbox.insertOne(aDoc({ traceparent: "cdp-request-id-1" }));

      const { payload } = await findInbox();

      expect(payload.data[0].traceparent).toBe("cdp-request-id-1");
    });

    it("returns null when the document carries no traceparent", async () => {
      await inbox.insertOne(aDoc());

      const { payload } = await findInbox();

      expect(payload.data[0].traceparent).toBeNull();
    });
  });

  describe("leakage", () => {
    it("never returns event, event.data or claimedBy", async () => {
      await inbox.insertOne(
        aDoc({
          claimedBy: "worker-1",
          event: {
            id: "evt-1",
            time: at(0),
            data: { clientRef: "APPLICATION-REF-1", sbi: "123456789" },
          },
        }),
      );

      const { payload } = await findInbox();

      expect(payload.data).toHaveLength(1);
      expect(JSON.stringify(payload)).not.toMatch(
        /claimedBy|"event"|details|APPLICATION-REF-1|123456789/,
      );
    });
  });
});
