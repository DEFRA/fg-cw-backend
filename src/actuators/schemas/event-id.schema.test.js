import { describe, expect, it } from "vitest";
import { eventIdParams } from "./event-id.schema.js";

const validate = (id) => eventIdParams.validate({ id });

describe("eventIdParams", () => {
  it("accepts a 24-character hex id", () => {
    expect(validate("665f1c2e9a1b2c3d4e5f6a7b").error).toBeUndefined();
  });

  it("accepts uppercase hex", () => {
    expect(validate("665F1C2E9A1B2C3D4E5F6A7B").error).toBeUndefined();
  });

  it("rejects a short id", () => {
    expect(validate("665f1c2e").error).toBeDefined();
  });

  it("rejects a long id", () => {
    expect(validate("665f1c2e9a1b2c3d4e5f6a7bcc").error).toBeDefined();
  });

  it("rejects non-hex characters", () => {
    expect(validate("665f1c2e9a1b2c3d4e5f6a7z").error).toBeDefined();
  });

  it("rejects a missing id", () => {
    expect(eventIdParams.validate({}).error).toBeDefined();
  });
});
