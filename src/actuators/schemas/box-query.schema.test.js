import { describe, expect, it } from "vitest";
import { actorQuery } from "./box-query.schema.js";

describe("actorQuery", () => {
  it("accepts an operator name", () => {
    expect(actorQuery.validate({ by: "donatas" }).error).toBeUndefined();
  });

  it("is optional - an unattributed mutation is still a mutation", () => {
    expect(actorQuery.validate({}).error).toBeUndefined();
  });

  it("caps the actor at 128 characters", () => {
    expect(actorQuery.validate({ by: "x".repeat(128) }).error).toBeUndefined();
    expect(actorQuery.validate({ by: "x".repeat(129) }).error).toBeDefined();
  });
});
