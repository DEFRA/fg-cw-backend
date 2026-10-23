import { describe, expect, it } from "vitest";
import { SupplementaryData } from "./supplementary-data.js";

describe("SupplementaryData", () => {
  it("starts empty and serializes as an opaque object", () => {
    expect(new SupplementaryData().toJSON()).toEqual({});
    const data = { anything: { nested: [1, null, { arbitrary: true }] } };
    expect(JSON.parse(JSON.stringify(new SupplementaryData(data)))).toEqual(
      data,
    );
  });

  it.each([null, [], "invalid", 42])("rejects an invalid root %j", (data) => {
    expect(() => new SupplementaryData(data)).toThrow(
      expect.objectContaining({
        output: expect.objectContaining({ statusCode: 422 }),
      }),
    );
  });

  it("protects its value from mutations to inputs and returned data", () => {
    const input = { results: [{ id: "first" }] };
    const original = new SupplementaryData(input);
    input.results.push({ id: "outside" });
    original.toJSON().results.push({ id: "outside" });
    original.getNode("results").push({ id: "outside" });
    const payload = { id: "second" };
    const updated = original.merge({
      targetNode: "results",
      dataType: "ARRAY",
      key: "id",
      data: payload,
    });
    payload.id = "changed";

    expect(original.toJSON()).toEqual({ results: [{ id: "first" }] });
    expect(updated.toJSON()).toEqual({
      results: [{ id: "first" }, { id: "second" }],
    });
  });

  it("replaces an array entry by its key without duplicating it", () => {
    const original = new SupplementaryData({
      results: [{ id: "first", value: 1 }, { id: "second" }],
    });
    const instruction = {
      targetNode: "results",
      dataType: "ARRAY",
      key: "id",
      data: { id: "first", value: 2 },
    };
    const updated = original.merge(instruction).merge(instruction);

    expect(updated.toJSON()).toEqual({
      results: [{ id: "first", value: 2 }, { id: "second" }],
    });
    expect(original.getNode("results")[0].value).toBe(1);
  });

  it("appends array entries without a merge key", () => {
    const updated = new SupplementaryData().merge({
      targetNode: "results",
      dataType: "ARRAY",
      data: { arbitrary: true },
    });
    expect(updated.toJSON()).toEqual({ results: [{ arbitrary: true }] });
  });

  it("merges keyed object entries while preserving other nodes", () => {
    const original = new SupplementaryData({
      results: { one: { id: "one", value: 1 } },
      untouched: ["existing"],
    });
    const updated = original.merge({
      targetNode: "results",
      dataType: "OBJECT",
      key: "id",
      data: { id: "two", arbitrary: true },
    });
    expect(updated.toJSON()).toEqual({
      results: {
        one: { id: "one", value: 1 },
        two: { id: "two", arbitrary: true },
      },
      untouched: ["existing"],
    });
  });

  it("rejects an object merge without a key", () => {
    expect(() =>
      new SupplementaryData().merge({
        targetNode: "results",
        dataType: "OBJECT",
        data: {},
      }),
    ).toThrow("without a key");
  });

  it.each([
    ["OBJECT", [{ id: "one" }]],
    ["ARRAY", { one: { id: "one" } }],
  ])("rejects a %s merge into the other container type", (dataType, node) => {
    const original = new SupplementaryData({ results: node });
    expect(() =>
      original.merge({
        targetNode: "results",
        dataType,
        key: "id",
        data: { id: "two" },
      }),
    ).toThrow(
      expect.objectContaining({
        output: expect.objectContaining({ statusCode: 422 }),
      }),
    );
    expect(original.toJSON()).toEqual({ results: node });
  });

  it.each(["bad.path", "$bad", "__proto__"])(
    "rejects unsafe target %s for merges and node replacement",
    (targetNode) => {
      const original = new SupplementaryData();
      expect(() =>
        original.merge({ targetNode, dataType: "ARRAY", data: {} }),
      ).toThrow();
      expect(() => original.withNode(targetNode, {})).toThrow();
      expect(original.toJSON()).toEqual({});
    },
  );

  it("replaces a node without mutating the original value", () => {
    const original = new SupplementaryData({ results: [{ id: "one" }] });
    const updated = original.withNode("results", [{ id: "two" }]);
    expect(original.toJSON()).toEqual({ results: [{ id: "one" }] });
    expect(updated.toJSON()).toEqual({ results: [{ id: "two" }] });
  });

  it("retains legacy no-op updates without a node or supported data type", () => {
    const original = new SupplementaryData({ results: [] });
    expect(original.merge({})).toBe(original);
    expect(original.merge({ targetNode: "results", data: [] })).toBe(original);
  });
});
