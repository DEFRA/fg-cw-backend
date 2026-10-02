import { describe, expect, it } from "vitest";
import {
  caseSearchHeaders,
  operatorHeaders,
} from "./operator-headers.schema.js";
import { OPERATOR_ID } from "../../../test/helpers/operator.js";

const valid = {
  "x-actor": "Jane Smith",
  "x-actor-id": OPERATOR_ID,
  host: "cw",
};

describe("operatorHeaders", () => {
  it("accepts both actor headers alongside any others", () => {
    expect(operatorHeaders.validate(valid).error).toBeUndefined();
  });

  it("accepts an RFC 8187-encoded name", () => {
    expect(
      operatorHeaders.validate({ ...valid, "x-actor": "UTF-8''%C5%81ukasz" })
        .error,
    ).toBeUndefined();
  });

  it.each([
    ["no x-actor", { "x-actor": undefined }],
    ["a blank x-actor", { "x-actor": " " }],
    ["no x-actor-id", { "x-actor-id": undefined }],
    ["an x-actor-id that is not a GUID", { "x-actor-id": "not-a-guid" }],
    ["a name over 128 characters", { "x-actor": "a".repeat(129) }],
  ])("refuses %s", (_name, headers) => {
    expect(
      operatorHeaders.validate({ ...valid, ...headers }).error,
    ).toBeDefined();
  });

  it("refuses a decoded name over 128 characters", () => {
    expect(
      operatorHeaders.validate({
        ...valid,
        "x-actor": `UTF-8''${"%C5%81".repeat(129)}`,
      }).error,
    ).toBeDefined();
  });
});

describe("caseSearchHeaders", () => {
  it("accepts x-search-repeat: 1", () => {
    expect(
      caseSearchHeaders.validate({ ...valid, "x-search-repeat": "1" }).error,
    ).toBeUndefined();
  });

  it("refuses any other repeat value", () => {
    expect(
      caseSearchHeaders.validate({ ...valid, "x-search-repeat": "true" }).error,
    ).toBeDefined();
  });
});
