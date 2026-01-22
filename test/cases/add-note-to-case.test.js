import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { IdpRoles } from "../../src/users/models/idp-roles.js";
import { createCase, findCaseById } from "../helpers/cases.js";
import { createAdminUser, upsertLoginUser } from "../helpers/users.js";
import { createWorkflow } from "../helpers/workflows.js";
import { wreck } from "../helpers/wreck.js";

describe("POST /cases/{caseId}/notes", () => {
  let cases;
  let client;
  let user;

  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
    cases = client.db().collection("cases");
  });

  afterAll(async () => {
    await client.close(true);
  });

  beforeEach(async () => {
    user = await createAdminUser();
    await createWorkflow();

    await upsertLoginUser({
      idpId: user.payload.idpId,
      name: user.payload.name,
      email: user.payload.email,
      idpRoles: [IdpRoles.ReadWrite],
      appRoles: user.payload.appRoles,
    });
  });

  it("adds a note to a case successfully", async () => {
    const kase = await createCase(cases);
    const noteText = "This is a test note for the case";

    const response = await wreck.post(`/cases/${kase._id}/notes`, {
      payload: {
        text: noteText,
      },
    });

    expect(response).toEqual({
      res: expect.objectContaining({
        statusCode: 201,
      }),
      payload: expect.objectContaining({
        caseId: kase._id.toString(),
        noteRef: expect.any(String),
      }),
    });

    const updatedCase = await findCaseById(kase._id);
    const addedNote = updatedCase.comments.find(
      (comment) => comment.ref === response.payload.noteRef,
    );

    expect(addedNote).toBeDefined();
    expect(addedNote.text).toBe(noteText);
    expect(addedNote.createdBy).toBeDefined();

    const timelineEvent = updatedCase.timeline.find(
      (entry) => entry.comment?.ref === response.payload.noteRef,
    );
    expect(timelineEvent).toBeDefined();
    expect(timelineEvent.eventType).toBe("NOTE_ADDED");
  });

  it("adds multiple notes to the same case", async () => {
    const kase = await createCase(cases);

    const note1Response = await wreck.post(`/cases/${kase._id}/notes`, {
      payload: { text: "First note" },
    });

    const note2Response = await wreck.post(`/cases/${kase._id}/notes`, {
      payload: { text: "Second note" },
    });

    expect(note1Response.payload.noteRef).not.toBe(
      note2Response.payload.noteRef,
    );

    const updatedCase = await findCaseById(kase._id);
    const notes = updatedCase.comments;

    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.text)).toContain("First note");
    expect(notes.map((n) => n.text)).toContain("Second note");
  });

  it("returns 403 when user does not have ReadWrite idp role", async () => {
    await upsertLoginUser({
      idpId: user.payload.idpId,
      name: user.payload.name,
      email: user.payload.email,
      idpRoles: [IdpRoles.Read],
      appRoles: user.payload.appRoles,
    });

    const kase = await createCase(cases);

    await expect(
      wreck.post(`/cases/${kase._id}/notes`, {
        payload: { text: "This note should fail" },
      }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });

  it("returns 403 when user does not have required workflow app roles", async () => {
    await upsertLoginUser({
      idpId: user.payload.idpId,
      name: user.payload.name,
      email: user.payload.email,
      idpRoles: user.payload.idpRoles,
      appRoles: {},
    });

    const kase = await createCase(cases);

    await expect(
      wreck.post(`/cases/${kase._id}/notes`, {
        payload: { text: "This note should fail" },
      }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });

  it("returns 404 when case does not exist", async () => {
    const nonExistentCaseId = "507f1f77bcf86cd799439011";

    await expect(
      wreck.post(`/cases/${nonExistentCaseId}/notes`, {
        payload: { text: "This note should fail" },
      }),
    ).rejects.toThrow("404 Not Found");
  });

  it("returns 400 for invalid case id format", async () => {
    const invalidCaseId = "invalid-case-id";

    await expect(
      wreck.post(`/cases/${invalidCaseId}/notes`, {
        payload: { text: "This note should fail" },
      }),
    ).rejects.toThrow("Bad Request");
  });

  it("returns 400 when note text is missing", async () => {
    const kase = await createCase(cases);

    await expect(
      wreck.post(`/cases/${kase._id}/notes`, {
        payload: {},
      }),
    ).rejects.toThrow("Bad Request");
  });

  it("returns 400 when note text is empty", async () => {
    const kase = await createCase(cases);

    await expect(
      wreck.post(`/cases/${kase._id}/notes`, {
        payload: { text: "" },
      }),
    ).rejects.toThrow("Bad Request");
  });
});
