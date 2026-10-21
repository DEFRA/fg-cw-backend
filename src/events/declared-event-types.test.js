import { describe, expect, it, vi } from "vitest";
import { actuators } from "../actuators/index.js";
import { cases } from "../cases/index.js";
import { users } from "../users/index.js";
import { INBOX, OUTBOX, eventTypeNames } from "./event-types.js";

vi.mock("../common/mongo-client.js");

// Only what main.js registers is imported, so a declaration nothing reaches
// from the running service is missing here too.
describe("declared event types", () => {
  it("loads with the plugins main.js registers", () => {
    expect(
      [cases, users, actuators].map((plugin) => plugin.name).every(Boolean),
    ).toBe(true);
  });

  it("lists every type the outbox sends", () => {
    expect(eventTypeNames(OUTBOX)).toEqual([
      "Audit",
      "CaseStatusUpdated",
      "Unrecognised",
    ]);
  });

  it("lists every type the inbox receives", () => {
    expect(eventTypeNames(INBOX)).toEqual([
      "ClaimSubmitted",
      "ConfigVersionUpdated",
      "CreateCase",
      "UpdateCaseStatus",
      "Unrecognised",
    ]);
  });

  // The same list is in fg-gas-backend's test of this name: an event carries
  // one name in the sender's outbox and the receiver's inbox.
  it("names the events that cross to and from GAS as GAS does", () => {
    const sent = ["CaseStatusUpdated"];
    const received = [
      "ClaimSubmitted",
      "CreateCase",
      "UpdateCaseStatus",
      "ConfigVersionUpdated",
    ];

    expect(eventTypeNames(OUTBOX)).toEqual(expect.arrayContaining(sent));
    expect(eventTypeNames(INBOX)).toEqual(expect.arrayContaining(received));
  });

  it("names every type in the words the Event column shows, with no dots", () => {
    for (const name of [...eventTypeNames(OUTBOX), ...eventTypeNames(INBOX)]) {
      expect(name).toMatch(/^([A-Z][a-z]+)+$/);
    }
  });
});
