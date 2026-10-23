import { describe, expect, it } from "vitest";
import {
  workflowCodeParams,
  workflowVersionParams,
  workflowVersionQuery,
} from "./workflow-version-request.schema.js";

describe("workflowVersionParams", () => {
  it.each([
    ["woodland", "1.2.0"],
    ["Casework-Smoke", "10.0.12"],
  ])("accepts %s at %s", (code, version) => {
    expect(
      workflowVersionParams.validate({ code, version }).error,
    ).toBeUndefined();
  });

  it.each([
    ["a code with other characters", { code: "wood_land", version: "1.0.0" }],
    ["a version that is not x.y.z", { code: "woodland", version: "1.0" }],
    ["a version with a suffix", { code: "woodland", version: "1.0.0-rc1" }],
    ["no version", { code: "woodland" }],
  ])("refuses %s", (_, params) => {
    expect(workflowVersionParams.validate(params).error).toBeDefined();
  });
});

describe("workflowCodeParams", () => {
  it("takes the workflow code alone", () => {
    expect(
      workflowCodeParams.validate({ code: "Casework-Smoke" }).error,
    ).toBeUndefined();
    expect(workflowCodeParams.validate({ code: "a/b" }).error).toBeDefined();
  });
});

describe("workflowVersionQuery", () => {
  it("takes only document as an include", () => {
    expect(workflowVersionQuery.validate({}).error).toBeUndefined();
    expect(
      workflowVersionQuery.validate({ include: "document" }).error,
    ).toBeUndefined();
    expect(
      workflowVersionQuery.validate({ include: "addresses" }).error,
    ).toBeDefined();
  });
});
