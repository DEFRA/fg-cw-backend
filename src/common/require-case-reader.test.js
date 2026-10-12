import { describe, expect, it } from "vitest";
import { requireCaseReader } from "./require-case-reader.js";

const h = { continue: Symbol("continue") };

const asClient = (service) => ({ auth: { credentials: { service } } });

describe("requireCaseReader", () => {
  it("admits fg-gas-backend", () => {
    expect(requireCaseReader(asClient("fg-gas-backend"), h)).toBe(h.continue);
  });

  it.each(["fg-grants-platform-admin", "test-client", undefined])(
    "answers 403 to %s",
    (service) => {
      expect(() => requireCaseReader(asClient(service), h)).toThrow(
        expect.objectContaining({
          output: expect.objectContaining({ statusCode: 403 }),
        }),
      );
    },
  );

  it("answers 403 with no credentials", () => {
    expect(() => requireCaseReader({ auth: {} }, h)).toThrow(
      "The case actuators are not open to this client",
    );
  });
});
