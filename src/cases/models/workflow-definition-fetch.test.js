import Boom from "@hapi/boom";
import { describe, expect, it } from "vitest";
import { S3FetchError } from "../../common/s3-client.js";
import { WorkflowDefinitionFetch } from "./workflow-definition-fetch.js";

describe("WorkflowDefinitionFetch", () => {
  it("records a stored workflow file", () => {
    expect({ ...WorkflowDefinitionFetch.stored() }).toEqual({
      file: "workflow",
      outcome: "stored",
    });
  });

  it.each(["missing", "forbidden", "timeout", "unparseable"])(
    "records a file that failed as %s",
    (reason) => {
      expect({ ...WorkflowDefinitionFetch.failed({ reason }) }).toEqual({
        file: "workflow",
        outcome: "failed",
        reason,
      });
    },
  );

  it("records an invalid file with its message", () => {
    expect({
      ...WorkflowDefinitionFetch.failed({
        reason: "invalid",
        message: 'Invalid Workflow "woodland": it has no initial position',
      }),
    }).toEqual({
      file: "workflow",
      outcome: "failed",
      reason: "invalid",
      message: 'Invalid Workflow "woodland": it has no initial position',
    });
  });

  it.each([
    ["NoSuchKey", "missing"],
    ["AccessDenied", "forbidden"],
    ["PARSE_ERROR", "unparseable"],
    ["ServiceUnavailable", "timeout"],
  ])("records an S3 %s as %s", (code, reason) => {
    const error = new S3FetchError("S3 said no", { code });

    expect({ ...WorkflowDefinitionFetch.fromError(error) }).toEqual({
      file: "workflow",
      outcome: "failed",
      reason,
    });
  });

  it("records a refused definition as invalid, its message cut to 500 characters", () => {
    const error = Boom.badData("x".repeat(600));

    expect({ ...WorkflowDefinitionFetch.fromError(error) }).toEqual({
      file: "workflow",
      outcome: "failed",
      reason: "invalid",
      message: "x".repeat(500),
    });
  });

  it.each([
    [
      "an unknown reason",
      { outcome: "failed", reason: "unavailable" },
      '"reason" must be one of',
    ],
    ["a failure with no reason", { outcome: "failed" }, '"reason" is required'],
    [
      "a reason on a stored file",
      { outcome: "stored", reason: "missing" },
      '"reason" is not allowed',
    ],
    [
      "a message with a reason other than invalid",
      { outcome: "failed", reason: "missing", message: "gone" },
      '"message" is not allowed',
    ],
    [
      "an invalid file with no message",
      { outcome: "failed", reason: "invalid" },
      '"message" is required',
    ],
    [
      "a message over 500 characters",
      { outcome: "failed", reason: "invalid", message: "x".repeat(501) },
      '"message" length must be less than or equal to 500',
    ],
    ["an unknown outcome", { outcome: "skipped" }, '"outcome" must be one of'],
    [
      "a file other than the workflow",
      { file: "grant", outcome: "stored" },
      '"file" must be [workflow]',
    ],
  ])("refuses %s", (_, props, reason) => {
    expect(
      () => new WorkflowDefinitionFetch({ file: "workflow", ...props }),
    ).toThrow(`Invalid WorkflowDefinitionFetch: ${reason}`);
  });
});
