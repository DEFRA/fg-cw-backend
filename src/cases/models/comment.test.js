import { describe, expect, it } from "vitest";
import {
  assertIsComment,
  assertIsCommentsArray,
  Comment,
  toComment,
  toComments,
} from "./comment.js";

describe("Comment", () => {
  describe("constructor", () => {
    it("creates comment with all required properties", () => {
      const props = {
        ref: "64c88faac1f56f71e1b89a33",
        type: "NOTE_ADDED",
        text: "Test comment text",
        createdBy: "user-123",
        createdAt: "2025-01-01T00:00:00.000Z",
      };

      const comment = new Comment(props);

      expect(comment.ref).toBe("64c88faac1f56f71e1b89a33");
      expect(comment.type).toBe("NOTE_ADDED");
      expect(comment.text).toBe("Test comment text");
      expect(comment.createdBy).toBe("user-123");
      expect(comment.createdAt).toBe("2025-01-01T00:00:00.000Z");
    });

    it("generates ObjectId ref when not provided", () => {
      const props = {
        type: "NOTE_ADDED",
        text: "Test comment text",
        createdBy: "user-123",
      };

      const comment = new Comment(props);

      expect(comment.ref).toBeDefined();
      expect(typeof comment.ref).toBe("string");
      expect(comment.ref).toHaveLength(24);
    });

    it("generates current ISO date when createdAt not provided", () => {
      const beforeCreation = new Date().toISOString();

      const props = {
        type: "NOTE_ADDED",
        text: "Test comment text",
        createdBy: "user-123",
      };

      const comment = new Comment(props);
      const afterCreation = new Date().toISOString();

      expect(comment.createdAt).toBeDefined();
      expect(comment.createdAt >= beforeCreation).toBe(true);
      expect(comment.createdAt <= afterCreation).toBe(true);
    });

    it("strips unknown properties", () => {
      const props = {
        type: "NOTE_ADDED",
        text: "Test comment text",
        createdBy: "user-123",
        unknownProperty: "should be stripped",
        anotherUnknown: 123,
      };

      const comment = new Comment(props);

      expect(comment.unknownProperty).toBeUndefined();
      expect(comment.anotherUnknown).toBeUndefined();
    });

    it("throws bad request when type is missing", () => {
      const props = {
        text: "Test comment text",
        createdBy: "user-123",
      };

      expect(() => new Comment(props)).toThrow("Invalid Comment");
    });

    it("throws bad request when text is missing", () => {
      const props = {
        type: "NOTE_ADDED",
        createdBy: "user-123",
      };

      expect(() => new Comment(props)).toThrow("Invalid Comment");
    });

    it("throws bad request when createdBy is missing", () => {
      const props = {
        type: "NOTE_ADDED",
        text: "Test comment text",
      };

      expect(() => new Comment(props)).toThrow("Invalid Comment");
    });

    it("throws bad request when createdAt is invalid ISO date", () => {
      const props = {
        type: "NOTE_ADDED",
        text: "Test comment text",
        createdBy: "user-123",
        createdAt: "invalid-date",
      };

      expect(() => new Comment(props)).toThrow("Invalid Comment");
    });

    it("throws bad request when ref is invalid", () => {
      const props = {
        ref: "invalid-object-id",
        type: "NOTE_ADDED",
        text: "Test comment text",
        createdBy: "user-123",
      };

      expect(() => new Comment(props)).toThrow("Invalid Comment");
    });
  });

  describe("getUserIds", () => {
    it("returns array with createdBy user ID", () => {
      const comment = new Comment({
        type: "NOTE_ADDED",
        text: "Test comment text",
        createdBy: "user-123",
      });

      const userIds = comment.getUserIds();

      expect(userIds).toEqual(["user-123"]);
    });
  });

  describe("title getter", () => {
    it("returns 'General' for NOTE_ADDED type", () => {
      const comment = new Comment({
        type: "NOTE_ADDED",
        text: "Test comment text",
        createdBy: "user-123",
      });

      expect(comment.title).toBe("General");
    });

    it("returns 'Task' for TASK_COMPLETED type", () => {
      const comment = new Comment({
        type: "TASK_COMPLETED",
        text: "Task completed comment",
        createdBy: "user-123",
      });

      expect(comment.title).toBe("Task");
    });

    it("returns 'General' for unknown type", () => {
      const comment = new Comment({
        type: "UNKNOWN_TYPE",
        text: "Unknown type comment",
        createdBy: "user-123",
      });

      expect(comment.title).toBe("General");
    });
  });
});

describe("toComment", () => {
  it("creates Comment instance from props", () => {
    const props = {
      type: "NOTE_ADDED",
      text: "Test comment text",
      createdBy: "user-123",
    };

    const comment = toComment(props);

    expect(comment).toBeInstanceOf(Comment);
    expect(comment.type).toBe("NOTE_ADDED");
    expect(comment.text).toBe("Test comment text");
    expect(comment.createdBy).toBe("user-123");
  });
});

describe("toComments", () => {
  it("creates array of Comment instances from props array", () => {
    const propsArray = [
      {
        type: "NOTE_ADDED",
        text: "First comment",
        createdBy: "user-1",
      },
      {
        type: "TASK_COMPLETED",
        text: "Second comment",
        createdBy: "user-2",
      },
    ];

    const comments = toComments(propsArray);

    expect(comments).toHaveLength(2);
    expect(comments[0]).toBeInstanceOf(Comment);
    expect(comments[1]).toBeInstanceOf(Comment);
    expect(comments[0].text).toBe("First comment");
    expect(comments[1].text).toBe("Second comment");
  });

  it("returns empty array when props is null", () => {
    const comments = toComments(null);

    expect(comments).toEqual([]);
  });

  it("returns empty array when props is undefined", () => {
    const comments = toComments(undefined);

    expect(comments).toEqual([]);
  });

  it("returns empty array when props is empty array", () => {
    const comments = toComments([]);

    expect(comments).toEqual([]);
  });
});

describe("assertIsComment", () => {
  it("returns comment when valid Comment instance", () => {
    const comment = new Comment({
      type: "NOTE_ADDED",
      text: "Test comment text",
      createdBy: "user-123",
    });

    const result = assertIsComment(comment);

    expect(result).toBe(comment);
  });

  it("throws bad request when not a Comment instance", () => {
    const notAComment = {
      type: "NOTE_ADDED",
      text: "Test comment text",
      createdBy: "user-123",
    };

    expect(() => assertIsComment(notAComment)).toThrow(
      "Must provide a valid Comment object",
    );
  });

  it("throws bad request when null", () => {
    expect(() => assertIsComment(null)).toThrow(
      "Must provide a valid Comment object",
    );
  });

  it("throws bad request when undefined", () => {
    expect(() => assertIsComment(undefined)).toThrow(
      "Must provide a valid Comment object",
    );
  });
});

describe("assertIsCommentsArray", () => {
  it("returns array when all items are Comment instances", () => {
    const comments = [
      new Comment({
        type: "NOTE_ADDED",
        text: "First comment",
        createdBy: "user-1",
      }),
      new Comment({
        type: "TASK_COMPLETED",
        text: "Second comment",
        createdBy: "user-2",
      }),
    ];

    const result = assertIsCommentsArray(comments);

    expect(result).toBe(comments);
  });

  it("returns empty array when provided with empty array", () => {
    const result = assertIsCommentsArray([]);

    expect(result).toEqual([]);
  });

  it("throws bad request when not an array", () => {
    expect(() => assertIsCommentsArray("not an array")).toThrow(
      "Expected an array of Comments",
    );
  });

  it("throws bad request when array contains non-Comment instance", () => {
    const comments = [
      new Comment({
        type: "NOTE_ADDED",
        text: "Valid comment",
        createdBy: "user-1",
      }),
      {
        type: "NOTE_ADDED",
        text: "Invalid comment object",
        createdBy: "user-2",
      },
    ];

    expect(() => assertIsCommentsArray(comments)).toThrow(
      "Item at index 1 is not a valid Comment instance",
    );
  });

  it("throws bad request when array contains null", () => {
    const comments = [
      new Comment({
        type: "NOTE_ADDED",
        text: "Valid comment",
        createdBy: "user-1",
      }),
      null,
    ];

    expect(() => assertIsCommentsArray(comments)).toThrow(
      "Item at index 1 is not a valid Comment instance",
    );
  });
});
