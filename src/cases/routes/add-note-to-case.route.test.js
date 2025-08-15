import Boom from "@hapi/boom";
import hapi from "@hapi/hapi";
import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addNoteToCaseRequestSchema } from "../schemas/requests/add-note-to-case-request.schema.js";
import { addNoteToCaseUseCase } from "../use-cases/add-note-to-case.use-case.js";
import { addNoteToCaseRoute } from "./add-note-to-case.route.js";

vi.mock("../use-cases/add-note-to-case.use-case.js");

describe("addNoteToCaseRoute", () => {
  const caseId = "808b8c8f8c8f8c8f8c8f8c8f";
  const payload = { text: "This is a test note" };

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
    const noteRef = new ObjectId().toHexString();

    addNoteToCaseUseCase.mockResolvedValue({ ref: noteRef });

    const { statusCode, result } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(201);
    expect(result).toEqual({ caseId, noteRef });
    expect(addNoteToCaseUseCase).toHaveBeenCalledWith({
      caseId,
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

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${invalidCaseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(400);
  });

  it("returns 404 not found when caseId is missing", async () => {
    const { statusCode } = await server.inject({
      method: "POST",
      url: "/cases//notes",
      payload,
    });

    expect(statusCode).toEqual(404);
  });

  it("accepts payload", async () => {
    const noteRef = new ObjectId().toHexString();

    addNoteToCaseUseCase.mockResolvedValue({ ref: noteRef });

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(201);
  });

  it("returns 400 bad request when text is missing from payload", async () => {
    const payload = {};

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(400);
  });

  it("returns 400 bad request when payload is empty", async () => {
    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload: {},
    });

    expect(statusCode).toEqual(400);
  });

  it("returns 400 bad request when text is empty string", async () => {
    const payload = { text: "" };

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(400);
  });

  it("strips unknown properties from payload", async () => {
    const noteRef = new ObjectId().toHexString();
    const payload = {
      text: "This is a test note",
      unknownProperty: "should be stripped",
    };

    addNoteToCaseUseCase.mockResolvedValue({ ref: noteRef });

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(201);

    expect(addNoteToCaseUseCase).toHaveBeenCalledWith({
      caseId,
      text: payload.text,
    });
  });

  it("returns 404 not found when case does not exist", async () => {
    addNoteToCaseUseCase.mockRejectedValue(
      Boom.notFound(`Case with id "${caseId}" not found`),
    );

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(404);
  });

  it("returns 500 internal server error when use case throws error", async () => {
    addNoteToCaseUseCase.mockRejectedValue(
      new Error("Database connection failed"),
    );

    const { statusCode } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/notes`,
      payload,
    });

    expect(statusCode).toEqual(500);
  });
});
