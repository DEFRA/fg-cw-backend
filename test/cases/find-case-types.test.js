import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAdminUser } from "../helpers/users.js";
import { createWorkflow } from "../helpers/workflows.js";
import { wreck } from "../helpers/wreck.js";

let client;
let workflows;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  workflows = client.db().collection("workflows");
});

afterAll(async () => {
  await client.close(true);
});

describe("GET /case-types", () => {
  beforeEach(async () => {
    await createAdminUser();
    await workflows.deleteMany({
      code: {
        $in: ["case-types-dedupe", "case-types-restricted"],
      },
    });
  });

  it("returns each case type code once and includes role-restricted workflows", async () => {
    await createWorkflow({
      code: "case-types-dedupe",
      version: "0.0.0",
    });
    await createWorkflow({
      code: "case-types-dedupe",
      version: "1.0.0",
    });
    await createWorkflow({
      code: "case-types-restricted",
      version: "0.0.0",
      requiredRoles: {
        allOf: ["ROLE_NOBODY_HAS"],
        anyOf: [],
      },
    });

    const response = await wreck.get("/case-types");

    expect(response.res.statusCode).toBe(200);
    expect(response.payload.header).toEqual({
      navItems: [
        { title: "Admin", href: "/admin" },
        { title: "Casework", href: "/cases" },
      ],
    });

    const codes = response.payload.data.map(({ code }) => code);
    const dedupeMatches = codes.filter((code) => code === "case-types-dedupe");

    expect(dedupeMatches).toHaveLength(1);
    expect(codes).toContain("case-types-restricted");
    expect(codes.indexOf("case-types-dedupe")).toBeLessThan(
      codes.indexOf("case-types-restricted"),
    );
  });
});
