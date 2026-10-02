import { describe, expect, it, vi } from "vitest";
import { getRequestContext } from "./request-context.js";
import { setAuditActor } from "./set-audit-actor.js";
import { OPERATOR_ID } from "../../test/helpers/operator.js";

vi.mock("./request-context.js");

const h = { continue: Symbol("continue") };

const run = (headers) => {
  const context = { ip: "10.0.0.1" };
  getRequestContext.mockReturnValue(context);

  return { answer: setAuditActor({ headers }, h), context };
};

describe("setAuditActor", () => {
  it("puts the operator's oid in the request context", () => {
    const { answer, context } = run({ "x-actor-id": OPERATOR_ID });

    expect(answer).toBe(h.continue);
    expect(context).toEqual({ ip: "10.0.0.1", user: OPERATOR_ID });
  });

  it.each([
    ["no header", {}],
    ["a value that is not a GUID", { "x-actor-id": "jane@example.com" }],
  ])("sets no user for %s", (_name, headers) => {
    const { answer, context } = run(headers);

    expect(answer).toBe(h.continue);
    expect(context).toEqual({ ip: "10.0.0.1" });
  });

  it("continues outside a request context", () => {
    getRequestContext.mockReturnValue(null);

    expect(setAuditActor({ headers: { "x-actor-id": OPERATOR_ID } }, h)).toBe(
      h.continue,
    );
  });
});
