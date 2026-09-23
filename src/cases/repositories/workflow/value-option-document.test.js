import { describe, it, expect } from "vitest";
import { ValueOptionDocument } from "./value-option-document.js";
import { CommentDocument } from "./comment-document.js";

describe("ValueOptionDocument", () => {
  it("sets comment to null when no comment is provided", () => {
    const doc = new ValueOptionDocument({
      code: "COMPLETE",
      name: "Complete",
      theme: "SUCCESS",
      completes: true,
    });

    expect(doc.comment).toBeNull();
  });

  it("wraps comment in a CommentDocument when provided", () => {
    const doc = new ValueOptionDocument({
      code: "ACCEPTED",
      name: "Accepted",
      theme: "NONE",
      completes: true,
      comment: {
        label: "Explain accepted",
        helpText: "Add notes",
        mandatory: true,
      },
    });

    expect(doc.comment).toBeInstanceOf(CommentDocument);
    expect(doc.comment).toEqual({
      label: "Explain accepted",
      helpText: "Add notes",
      mandatory: true,
    });
  });
});
