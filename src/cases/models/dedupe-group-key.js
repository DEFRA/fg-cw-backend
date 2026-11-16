import { createHash } from "node:crypto";
import { DedupeError } from "./dedupe-label.js";

const scalar = (value) =>
  (typeof value === "string" && value.trim().length > 0) ||
  (typeof value === "number" && Number.isFinite(value));

export const keyName = (entry) => entry.name ?? entry.value.split(".").at(-1);

export class DedupeGroupKey {
  // eslint-disable-next-line complexity -- Reject malformed and non-scalar identity values.
  constructor(caseType, values) {
    if (!values || Array.isArray(values) || !Object.keys(values).length)
      throw new DedupeError("Invalid grouping key");
    if (!Object.values(values).every(scalar))
      throw new DedupeError("Grouping values must be non-empty scalar values");
    this.caseType = caseType;
    this.values = Object.fromEntries(
      Object.entries(values).sort(([a], [b]) => a.localeCompare(b)),
    );
    this.canonical = JSON.stringify(this.values);
  }

  get hash() {
    return createHash("sha256")
      .update(JSON.stringify([this.caseType, this.canonical]))
      .digest("hex");
  }

  // A reversible typed key enables indexed detail reads before any assignment.
  get routeKey() {
    return Buffer.from(this.canonical).toString("base64url");
  }

  static fromRoute(caseType, token, names) {
    try {
      const key = new DedupeGroupKey(
        caseType,
        JSON.parse(Buffer.from(token, "base64url").toString("utf8")),
      );
      if (
        key.routeKey !== token ||
        JSON.stringify(Object.keys(key.values).sort()) !==
          JSON.stringify([...names].sort())
      )
        throw new Error("Key does not match the grouping definition");
      return key;
    } catch {
      throw new DedupeError("Invalid grouping key");
    }
  }
}
