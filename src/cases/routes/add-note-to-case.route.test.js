import hapi from "@hapi/hapi";
import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addNoteToCaseRequestSchema } from "../schemas/requests/add-note-to-case-request.schema.js";
import { addNoteToCaseUseCase } from "../use-cases/add-note-to-case.use-case.js";
import { addNoteToCaseRoute } from "./add-note-to-case.route.js";

vi.mock("../use-cases/add-note-to-case.use-case.js");

describe("addNoteToCaseRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(addNoteToCaseRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("adds note to case successfully", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";
    const noteRef = new ObjectId().toHexString();
    const payload = {
      type: "NOTE_ADDED",
      text: "This is a test note",
    };

    addNoteToCaseUseCase.mockResolvedValue({
      ref: noteRef,
    });

    const { statusCode, result } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(201);
    expect(result).toEqual({
      caseId,
      noteRef,
    });

    expect(addNoteToCaseUseCase).toHaveBeenCalledWith({
      caseId,
      type: payload.type,
      text: payload.text,
    });
  });

  it("validates payload using addNoteToCaseRequestSchema", () => {
    expect(addNoteToCaseRoute.options.validate.payload).toBe(
      addNoteToCaseRequestSchema,
    );
  });

  it("returns 400 bad request when caseId is invalid", async () => {
    const invalidCaseId = "invalid-case-id";
    const payload = {
      type: "NOTE_ADDED",
      text: "This is a test note",
    };

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${invalidCaseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(400);
  });

  it("returns 404 not found when caseId is missing", async () => {
    const payload = {
      type: "NOTE_ADDED",
      text: "This is a test note",
    };

    const { statusCode } = await server.inject({
      method: "POST",
      url: "/cases//notes",
      payload,
    });

    expect(statusCode).toEqual(404);
  });

  it("returns 400 bad request when type is missing from payload", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";
    const payload = {
      text: "This is a test note",
    };

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(400);
  });

  it("returns 400 bad request when text is missing from payload", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";
    const payload = {
      type: "NOTE_ADDED",
    };

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(400);
  });

  it("returns 400 bad request when payload is empty", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload: {},
    });

    expect(statusCode).toEqual(400);
  });

  it("returns 400 bad request when type is empty string", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";
    const payload = {
      type: "",
      text: "This is a test note",
    };

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(400);
  });

  it("returns 400 bad request when text is empty string", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";
    const payload = {
      type: "NOTE_ADDED",
      text: "",
    };

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(400);
  });

  it("strips unknown properties from payload", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";
    const noteRef = new ObjectId().toHexString();
    const payload = {
      type: "NOTE_ADDED",
      text: "This is a test note",
      unknownProperty: "should be stripped",
    };

    addNoteToCaseUseCase.mockResolvedValue({
      ref: noteRef,
    });

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(201);

    expect(addNoteToCaseUseCase).toHaveBeenCalledWith({
      caseId,
      type: payload.type,
      text: payload.text,
    });
  });

  it("returns 500 internal server error when use case throws error", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";
    const payload = {
      type: "NOTE_ADDED",
      text: "This is a test note",
    };

    addNoteToCaseUseCase.mockRejectedValue(new Error("Case not found"));

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(500);
  });
});
