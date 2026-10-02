import { describe, expect, it } from "vitest";
import { decodeActor } from "./actor-header.js";

describe("decodeActor", () => {
  it("keeps a plain name verbatim", () => {
    expect(decodeActor("Jane Smith")).toBe("Jane Smith");
  });

  it("decodes an RFC 8187 name", () => {
    expect(decodeActor("UTF-8''%C5%81ukasz")).toBe("Łukasz");
  });

  it("keeps an undecodable value as it stands", () => {
    expect(decodeActor("UTF-8''%E0%A4%A")).toBe("UTF-8''%E0%A4%A");
  });

  it("answers undefined for no header", () => {
    expect(decodeActor(undefined)).toBeUndefined();
  });
});
