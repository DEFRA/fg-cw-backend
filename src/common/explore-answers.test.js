import { describe, expect, it } from "vitest";
import { answerOfRefusal, queryInvalid } from "./explore-answers.js";
import { refuseQuery } from "./explore/refusal.js";

const answerOf = (error) => {
  try {
    answerOfRefusal(error);
  } catch (answer) {
    return answer;
  }

  return null;
};

describe("answerOfRefusal", () => {
  it.each([
    ["INVALID", 400, { reason: "EXPLORE_QUERY_INVALID" }],
    ["BUSY", 429, { reason: "EXPLORE_QUERY_BUSY", refusal: "BUSY" }],
    ["FULL", 429, { reason: "EXPLORE_QUERY_BUSY", refusal: "FULL" }],
  ])("answers %s by its own reason", (code, statusCode, payload) => {
    expect(answerOf(refuseQuery(code)).output.payload).toEqual({
      statusCode,
      ...payload,
    });
  });

  it("answers any other refusal by its code and why, for GAS to word", () => {
    const detail = { why: null, path: null, noun: "workflow definitions" };

    expect(answerOf(refuseQuery("TOO_BIG", detail)).output.payload).toEqual({
      statusCode: 400,
      reason: "EXPLORE_QUERY_REFUSED",
      refusal: "TOO_BIG",
      detail,
    });
    expect(
      answerOf(refuseQuery("PATH_NOT_ALLOWED")).output.payload,
    ).not.toHaveProperty("detail");
  });

  it("logs every refusal as an answer, at info", () => {
    expect(
      ["INVALID", "BUSY", "TOO_BIG"].map(
        (code) => answerOf(refuseQuery(code)).data,
      ),
    ).toEqual([
      { logLevel: "info" },
      { logLevel: "info" },
      { logLevel: "info" },
    ]);
  });

  it("passes on an error that is no refusal", () => {
    const error = new Error("Mongo down");

    expect(answerOf(error)).toBe(error);
  });
});

describe("queryInvalid", () => {
  it("is a 400 naming no more than its reason", () => {
    expect(queryInvalid().output.payload).toEqual({
      statusCode: 400,
      reason: "EXPLORE_QUERY_INVALID",
    });
  });
});
