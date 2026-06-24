import { describe, expect, it } from "vitest";
import {
  buildAfterContent,
  buildBeforeContent,
} from "./build-stage-content.js";

const context = { position: { statusCode: "IN_REVIEW" } };

describe("buildBeforeContent", () => {
  it("returns empty array when stage has no beforeContent", async () => {
    const result = await buildBeforeContent({}, context);
    expect(result).toEqual([]);
  });

  it("includes item when renderIf is truthy", async () => {
    const stage = {
      beforeContent: [
        {
          renderIf: "jsonata:$.position.statusCode = 'IN_REVIEW'",
          content: [{ component: "heading", text: "In review", level: 2 }],
        },
      ],
    };

    const result = await buildBeforeContent(stage, context);

    expect(result).toEqual([
      { component: "heading", text: "In review", level: 2 },
    ]);
  });

  it("excludes item when renderIf is falsy", async () => {
    const stage = {
      beforeContent: [
        {
          renderIf: "jsonata:$.position.statusCode = 'OTHER_STATUS'",
          content: [
            { component: "heading", text: "Should not appear", level: 2 },
          ],
        },
      ],
    };

    const result = await buildBeforeContent(stage, context);

    expect(result).toEqual([]);
  });

  it("includes item when there is no renderIf", async () => {
    const stage = {
      beforeContent: [
        {
          content: [{ component: "paragraph", text: "Always visible" }],
        },
      ],
    };

    const result = await buildBeforeContent(stage, context);

    expect(result).toEqual([
      { component: "paragraph", text: "Always visible" },
    ]);
  });

  it("flattens multiple items into a single array", async () => {
    const stage = {
      beforeContent: [
        {
          renderIf: "jsonata:$.position.statusCode = 'IN_REVIEW'",
          content: [{ component: "heading", text: "First", level: 2 }],
        },
        {
          renderIf: "jsonata:$.position.statusCode = 'IN_REVIEW'",
          content: [{ component: "paragraph", text: "Second" }],
        },
      ],
    };

    const result = await buildBeforeContent(stage, context);

    expect(result).toEqual([
      { component: "heading", text: "First", level: 2 },
      { component: "paragraph", text: "Second" },
    ]);
  });
});

describe("buildAfterContent", () => {
  it("returns empty array when stage has no afterContent", async () => {
    const result = await buildAfterContent({}, context);
    expect(result).toEqual([]);
  });

  it("includes item when renderIf is truthy", async () => {
    const stage = {
      afterContent: [
        {
          renderIf: "jsonata:$.position.statusCode = 'IN_REVIEW'",
          content: [{ component: "warning-text", text: "Review in progress" }],
        },
      ],
    };

    const result = await buildAfterContent(stage, context);

    expect(result).toEqual([
      { component: "warning-text", text: "Review in progress" },
    ]);
  });

  it("excludes item when renderIf is falsy", async () => {
    const stage = {
      afterContent: [
        {
          renderIf: "jsonata:$.position.statusCode = 'OTHER_STATUS'",
          content: [{ component: "warning-text", text: "Should not appear" }],
        },
      ],
    };

    const result = await buildAfterContent(stage, context);

    expect(result).toEqual([]);
  });

  it("includes item when there is no renderIf", async () => {
    const stage = {
      afterContent: [
        {
          content: [{ component: "paragraph", text: "Always visible" }],
        },
      ],
    };

    const result = await buildAfterContent(stage, context);

    expect(result).toEqual([
      { component: "paragraph", text: "Always visible" },
    ]);
  });

  it("flattens multiple items into a single array", async () => {
    const stage = {
      afterContent: [
        {
          renderIf: "jsonata:$.position.statusCode = 'IN_REVIEW'",
          content: [{ component: "heading", text: "First", level: 2 }],
        },
        {
          renderIf: "jsonata:$.position.statusCode = 'IN_REVIEW'",
          content: [{ component: "paragraph", text: "Second" }],
        },
      ],
    };

    const result = await buildAfterContent(stage, context);

    expect(result).toEqual([
      { component: "heading", text: "First", level: 2 },
      { component: "paragraph", text: "Second" },
    ]);
  });
});
