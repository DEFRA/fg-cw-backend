import { describe, expect, it } from "vitest";
import {
  apiClientOperatorHeaders,
  caseSearchHeaders,
  operatorHeaders,
} from "./operator-headers.schema.js";
import { OPERATOR_ID } from "../../../test/helpers/operator.js";

const valid = {
  "x-actor": "Example Assignee",
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

describe("apiClientOperatorHeaders", () => {
  const HEX_RUN = "0123456789abcdef".repeat(4);

  it("accepts a name with shorter hex runs", () => {
    expect(
      apiClientOperatorHeaders.validate({
        ...valid,
        "x-actor": `${HEX_RUN.slice(1)} ${HEX_RUN.slice(1)}`,
      }).error,
    ).toBeUndefined();
  });

  it.each([
    ["64 hex characters", HEX_RUN],
    ["64 upper-case hex characters in a name", `Jo ${HEX_RUN.toUpperCase()}`],
    [
      "64 hex characters once decoded",
      `UTF-8''${[...HEX_RUN].map((c) => `%${c.charCodeAt(0).toString(16)}`).join("")}`,
    ],
  ])("refuses %s, without echoing it", (_name, actor) => {
    const { error } = apiClientOperatorHeaders.validate({
      ...valid,
      "x-actor": actor,
    });

    expect(error).toBeDefined();
    expect(error.message).not.toContain(HEX_RUN);
  });

  it("keeps the other operator header rules", () => {
    expect(
      apiClientOperatorHeaders.validate({ ...valid, "x-actor-id": "x" }).error,
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
