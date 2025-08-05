import { randomUUID } from "node:crypto";

export class Comment {
  constructor(type, text) {
    this.ref = randomUUID();
    this.type = type;
    this.createdAt = new Date().toISOString();
    this.text = encodeURIComponent(text);
  }

  createMock(type, text, ref, createdAt) {
    return {
      ref,
      type,
      text,
      createdAt,
    };
  }
}
