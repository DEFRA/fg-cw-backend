import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  editInboxPayload,
  editOutboxPayload,
  getInboxEvent,
  getOutboxEvent,
  purgeInboxEvent,
  purgeOutboxEvent,
  redriveInboxEvent,
  redriveOutboxEvent,
  seedCaseReaderToken,
} from "../helpers/actuators.js";
import { operatorHeaders } from "../helpers/operator.js";
import { SERVICE_TOKEN } from "../helpers/service-token.js";

let client;
let inbox;
let outbox;

const OTHER_CLIENT = `Bearer ${SERVICE_TOKEN}`;

const aDeadRow = (overrides) => ({
  _id: new ObjectId(),
  segregationRef: `GUARD-${new ObjectId().toHexString()}`,
  status: "DEAD_LETTER",
  completionAttempts: 5,
  publicationDate: new Date("2026-06-16T10:00:00.000Z"),
  lastResubmissionDate: "2026-06-16T10:05:00.000Z",
  completionDate: null,
  expireAt: null,
  lastError: { name: "TypeError", message: "boom", at: null },
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  event: { id: "evt-1", type: "cloud.defra.test.x", data: { amount: "12" } },
  ...overrides,
});

const purge = { by: "Mallory", reasonCode: "OTHER", note: "Not mine" };
const edit = {
  by: "Mallory",
  payload: { id: "evt-1", data: { amount: 12 } },
  note: "Not mine",
  revision: 0,
};

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  inbox = client.db().collection("inbox");
  outbox = client.db().collection("outbox");
  await seedCaseReaderToken(client.db());
});

afterAll(async () => {
  await client?.close(true);
});

describe("the event actuators, to a client other than fg-gas-backend", () => {
  it.each([
    ["reading an inbox event", (id) => getInboxEvent(id, OTHER_CLIENT)],
    ["reading an outbox event", (id) => getOutboxEvent(id, OTHER_CLIENT)],
    [
      "redriving an inbox event",
      (id) =>
        redriveInboxEvent(id, { by: "Mallory" }, OTHER_CLIENT, operatorHeaders),
    ],
    [
      "redriving an outbox event",
      (id) => redriveOutboxEvent(id, { by: "Mallory" }, OTHER_CLIENT),
    ],
    [
      "purging an inbox event",
      (id) => purgeInboxEvent(id, purge, OTHER_CLIENT, operatorHeaders),
    ],
    [
      "purging an outbox event",
      (id) => purgeOutboxEvent(id, purge, OTHER_CLIENT),
    ],
    [
      "editing an inbox event's payload",
      (id) => editInboxPayload(id, edit, OTHER_CLIENT, operatorHeaders),
    ],
    [
      "editing an outbox event's payload",
      (id) => editOutboxPayload(id, edit, OTHER_CLIENT),
    ],
  ])("answers 403 to %s and changes nothing", async (name, call) => {
    const inboxRow = aDeadRow({ messageId: `msg-${new ObjectId()}` });
    const outboxRow = aDeadRow({ target: "arn:aws:sns:eu-west-2:0:t.fifo" });
    await inbox.insertOne(inboxRow);
    await outbox.insertOne(outboxRow);

    const row = name.includes("inbox") ? inboxRow : outboxRow;

    await expect(call(row._id.toHexString())).rejects.toThrow(
      "Response Error: 403 Forbidden",
    );

    expect(await inbox.find().toArray()).toEqual([inboxRow]);
    expect(await outbox.find().toArray()).toEqual([outboxRow]);
  });
});
