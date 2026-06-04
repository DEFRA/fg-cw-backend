import { ObjectId } from "mongodb";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { config } from "../../../common/config.js";
import { applyOverride, findOverrideDocument } from "./workflow-override.js";

vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));
vi.mock("../../../common/config.js", () => ({ config: { get: vi.fn() } }));
vi.mock("../../../common/logger.js", () => ({ logger: { info: vi.fn() } }));

const MANIFEST_PATH = "/cfg/overrides.json";

const mockConfig = (cdpEnvironment, workflowOverrides) => {
  config.get.mockImplementation((key) => {
    if (key === "cdpEnvironment") {
      return cdpEnvironment;
    }
    if (key === "workflowOverrides") {
      return workflowOverrides;
    }
    return undefined;
  });
};

const mockFiles = (files) => {
  readFileSync.mockImplementation((path) => {
    if (files[path] === undefined) {
      throw new Error(`unexpected readFileSync: ${path}`);
    }
    return files[path];
  });
};

describe("findOverrideDocument", () => {
  it("loads the workflow document from the override file", () => {
    mockConfig("local", MANIFEST_PATH);
    mockFiles({
      [MANIFEST_PATH]: JSON.stringify({ woodland: "woodland.json" }),
      "/cfg/woodland.json": JSON.stringify({ code: "woodland" }),
    });

    const result = findOverrideDocument("woodland");

    expect(result.code).toBe("woodland");
    expect(result._id).toBeInstanceOf(ObjectId);
  });

  it("resolves the definition path relative to the manifest directory", () => {
    mockConfig("local", MANIFEST_PATH);
    mockFiles({
      [MANIFEST_PATH]: JSON.stringify({ woodland: "nested/woodland.json" }),
      "/cfg/nested/woodland.json": JSON.stringify({ code: "woodland" }),
    });

    const result = findOverrideDocument("woodland");

    expect(result.code).toBe("woodland");
  });

  it("returns null when not running locally", () => {
    mockConfig("prod", MANIFEST_PATH);

    expect(findOverrideDocument("woodland")).toBeNull();
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("returns null when no override manifest is configured", () => {
    mockConfig("local", null);

    expect(findOverrideDocument("woodland")).toBeNull();
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("returns null when the code is not in the manifest", () => {
    mockConfig("local", MANIFEST_PATH);
    mockFiles({ [MANIFEST_PATH]: JSON.stringify({ other: "other.json" }) });

    expect(findOverrideDocument("woodland")).toBeNull();
  });

  it("synthesises an ObjectId when the file has no _id", () => {
    mockConfig("local", MANIFEST_PATH);
    mockFiles({
      [MANIFEST_PATH]: JSON.stringify({ woodland: "woodland.json" }),
      "/cfg/woodland.json": JSON.stringify({ code: "woodland" }),
    });

    expect(findOverrideDocument("woodland")._id).toBeInstanceOf(ObjectId);
  });

  it("preserves a string _id", () => {
    const hex = "507f1f77bcf86cd799439011";
    mockConfig("local", MANIFEST_PATH);
    mockFiles({
      [MANIFEST_PATH]: JSON.stringify({ woodland: "woodland.json" }),
      "/cfg/woodland.json": JSON.stringify({ code: "woodland", _id: hex }),
    });

    expect(findOverrideDocument("woodland")._id.toHexString()).toBe(hex);
  });

  it("preserves an extended-JSON ($oid) _id", () => {
    const hex = "507f1f77bcf86cd799439011";
    mockConfig("local", MANIFEST_PATH);
    mockFiles({
      [MANIFEST_PATH]: JSON.stringify({ woodland: "woodland.json" }),
      "/cfg/woodland.json": JSON.stringify({
        code: "woodland",
        _id: { $oid: hex },
      }),
    });

    expect(findOverrideDocument("woodland")._id.toHexString()).toBe(hex);
  });
});

describe("applyOverride", () => {
  it("returns the override document when one exists for the code", () => {
    mockConfig("local", MANIFEST_PATH);
    mockFiles({
      [MANIFEST_PATH]: JSON.stringify({ woodland: "woodland.json" }),
      "/cfg/woodland.json": JSON.stringify({
        code: "woodland",
        templates: "from-override",
      }),
    });

    const result = applyOverride({ code: "woodland", templates: "from-db" });

    expect(result.templates).toBe("from-override");
  });

  it("returns the original document when no override exists", () => {
    mockConfig("local", MANIFEST_PATH);
    mockFiles({ [MANIFEST_PATH]: JSON.stringify({ other: "other.json" }) });

    const original = { code: "woodland", templates: "from-db" };

    expect(applyOverride(original)).toBe(original);
  });
});
