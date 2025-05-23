import { describe, it, expect } from "vitest";
import { caseEvents } from "./case-events.js";
import { eventController } from "../controller/event.controller.js";
import { caseSchema } from "../schema/case.schema.js";
import { commonSchema } from "../schema/common.schema.js";

describe("Case Events Route Definitions", () => {
  it("should define the correct POST /events route", () => {
    expect(caseEvents).toBeInstanceOf(Array);
    expect(caseEvents).toHaveLength(1);
    const eventRoute = caseEvents[0];

    // Verify method and path
    expect(eventRoute).toHaveProperty("method", "POST");
    expect(eventRoute).toHaveProperty("path", "/handlers-events");

    // Verify options
    expect(eventRoute).toHaveProperty("options");
    const { options } = eventRoute;

    expect(options).toHaveProperty(
      "description",
      "Receive a create handlers event"
    );
    expect(options).toHaveProperty("tags");
    expect(options.tags).toContain("api");

    // Verify payload validation
    expect(options).toHaveProperty("validate");
    expect(options.validate).toHaveProperty(
      "payload",
      caseSchema.GrantCaseEvent
    );

    // Verify response status schema
    expect(options).toHaveProperty("response");
    expect(options.response).toHaveProperty("status");
    expect(options.response.status).toHaveProperty("201", caseSchema.Case);
    expect(options.response.status).toHaveProperty(
      "400",
      commonSchema.ValidationError
    );

    // Verify handler
    expect(eventRoute).toHaveProperty("handler", eventController);
  });

  it("should define the payload validation schema correctly", () => {
    const eventRoute = caseEvents[0];
    const { validate } = eventRoute.options;

    // Ensure the payload is bound to `GrantCaseEvent` schema
    expect(validate).toHaveProperty("payload", caseSchema.GrantCaseEvent);
  });

  it("should register the correct response schemas", () => {
    const eventRoute = caseEvents[0];
    const { response } = eventRoute.options;

    // Verify 201 and 400 response schemas
    expect(response.status).toHaveProperty("201", caseSchema.Case);
    expect(response.status).toHaveProperty("400", commonSchema.ValidationError);
  });
});
