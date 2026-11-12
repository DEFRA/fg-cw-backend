import Hapi from "@hapi/hapi";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { dedupePageRoutes } from "../src/cases/routes/dedupe-page.route.js";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../src/cases/repositories/case.repository.js";
import * as dedupeRepository from "../src/cases/repositories/dedupe.repository.js";
import { db, mongoClient } from "../src/common/mongo-client.js";
import { requestContext } from "../src/common/request-context.js";
import { setAuditActor } from "../src/common/set-audit-actor.js";
import { IdpRoles } from "../src/users/models/idp-roles.js";
import { User } from "../src/users/models/user.js";
import { dedupeTab, seedDedupe } from "./helpers/dedupe-seed.js";

describe("configured dedupe application routes with MongoDB", () => {
  let server;
  let seed;
  let actor;
  const base = "/case-types/frps-private-beta/pages/duplicates";
  const request = async (method, url, payload, status = 200) => {
    const response = await server.inject({
      method,
      url,
      ...(payload && { payload }),
    });
    expect(response.statusCode, response.payload).toBe(status);
    return response.result;
  };
  const summary = async () => (await request("GET", base)).data;
  const groupUrl = async () =>
    `${base}/groups/${(await summary()).rows.find((row) => row.details.sbi === "244666513").keyHash}`;
  beforeAll(async () => {
    await mongoClient.connect();
    server = Hapi.server();
    await server.register(requestContext);
    server.auth.scheme("test-user", () => ({
      authenticate: (_request, h) =>
        h.authenticated({ credentials: { user: actor } }),
    }));
    server.auth.strategy("test-user", "test-user");
    server.auth.default("test-user");
    server.ext("onPostAuth", setAuditActor);
    server.route(dedupePageRoutes);
  });
  beforeEach(async () => {
    await db.dropDatabase();
    seed = await seedDedupe();
    actor = seed.user;
  });
  afterAll(async () => {
    await server?.stop();
    await db.dropDatabase();
    await mongoClient.close();
  });

  it("discovers the workflow's tab and only shows the three live duplicate groups", async () => {
    expect((await request("GET", "/case-list-pages")).data.pages).toEqual([
      expect.objectContaining({
        href: "/types/frps-private-beta/pages/duplicates",
        title: "Clean the list",
      }),
    ]);
    const result = await summary();
    expect(result.heading).toBe("0 of 3 issues completed");
    expect(result.rows.map((row) => row.details.sbi)).toEqual([
      "244666515",
      "244666514",
      "244666513",
    ]);
    expect((await request("GET", await groupUrl())).data.cases).toHaveLength(3);
  });
  it("persists labels and timeline through real Case hydration and normal case updates", async () => {
    const url = await groupUrl();
    const payload = {
      assignee: seed.user.id,
      labels: {
        300241: { code: "NOT_DUPLICATE" },
        300242: { code: "DUPLICATE", data: { duplicateOf: "300241" } },
      },
    };
    expect((await request("PUT", url, payload)).changedLabels).toBe(2);
    expect((await summary()).heading).toBe("1 of 3 issues completed");
    expect((await request("PUT", url, payload)).changedLabels).toBe(0);
    const kase = await findByCaseRefAndWorkflowCode(
      "300242",
      "frps-private-beta",
    );
    expect(kase.labels[0].data.duplicateOf).toBe("300241");
    expect(
      kase.timeline.filter((event) => event.eventType === "CASE_LABEL_CHANGED"),
    ).toHaveLength(1);
    await update(kase);
    const stored = await db.collection("cases").findOne({ caseRef: "300242" });
    expect(stored.labels[0].namespace).toBe("duplicates");
    expect(await db.collection("case_groups").countDocuments()).toBe(1);
    expect(await db.collection("outbox").countDocuments()).toBeGreaterThan(0);
    await seed.addCase("300260", "244666513");
    expect((await summary()).heading).toBe("0 of 3 issues completed");
    expect((await request("GET", url)).data.owner.id).toBe(seed.user.id);
  });
  it("excludes withdrawn cases, preserves historical targets, and keeps hidden details readable", async () => {
    const url = await groupUrl();
    const label = { code: "DUPLICATE", data: { duplicateOf: "300241" } };
    await request("PUT", url, { assignee: null, labels: { 300242: label } });
    await db
      .collection("cases")
      .updateOne(
        { caseRef: "300241" },
        { $set: { currentStatus: "APPLICATION_WITHDRAWN" } },
      );
    expect((await summary()).total).toBe(2);
    const detail = (await request("GET", url)).data;
    expect(
      detail.cases.find((kase) => kase.caseRef === "300241").excluded,
    ).toBe(true);
    expect(
      detail.cases.find((kase) => kase.caseRef === "300242").options,
    ).toHaveLength(2);
    expect(
      (
        await request("PUT", url, {
          assignee: seed.user.id,
          labels: { 300242: label },
        })
      ).changedLabels,
    ).toBe(0);
    await request(
      "PUT",
      url,
      { assignee: null, labels: { 300241: null } },
      400,
    );
  });
  it("validates the owner and every label before writing anything", async () => {
    const url = await groupUrl();
    for (const labels of [
      { 300244: { code: "NOT_DUPLICATE" } },
      { 300241: { code: "DUPLICATE", data: { duplicateOf: "300241" } } },
      { 300241: { code: "DUPLICATE", data: { duplicateOf: "300243" } } },
    ])
      await request("PUT", url, { assignee: seed.user.id, labels }, 400);
    await request(
      "PUT",
      url,
      { assignee: "000000000000000000000000", labels: {} },
      400,
    );
    expect(await db.collection("case_groups").countDocuments()).toBe(0);
    expect(
      (await db.collection("cases").findOne({ caseRef: "300241" })).labels,
    ).toEqual([]);
  });

  it("clears a label without changing another namespace and audits only the change", async () => {
    const url = await groupUrl();
    await db
      .collection("cases")
      .updateOne(
        { caseRef: "300241" },
        { $set: { labels: [{ namespace: "other", code: "REVIEWED" }] } },
      );
    await request("PUT", url, {
      assignee: null,
      labels: { 300241: { code: "NOT_DUPLICATE" } },
    });
    await request("PUT", url, { assignee: null, labels: { 300241: null } });
    expect(
      (await request("PUT", url, { assignee: null, labels: { 300241: null } }))
        .changedLabels,
    ).toBe(0);
    const kase = await db.collection("cases").findOne({ caseRef: "300241" });
    expect(kase.labels).toEqual([{ namespace: "other", code: "REVIEWED" }]);
    expect(
      kase.timeline.filter((event) => event.eventType === "CASE_LABEL_CHANGED"),
    ).toHaveLength(2);
    expect(kase.timeline[0].data.newLabel).toBe(null);
    expect(await db.collection("case_groups").countDocuments()).toBe(0);
  });
  it("rolls back labels and timeline when the owner write fails", async () => {
    const url = await groupUrl();
    vi.spyOn(dedupeRepository, "saveGroupOwner").mockRejectedValueOnce(
      new Error("Forced owner failure"),
    );
    await request(
      "PUT",
      url,
      { assignee: seed.user.id, labels: { 300241: { code: "NOT_DUPLICATE" } } },
      500,
    );
    const kase = await db.collection("cases").findOne({ caseRef: "300241" });
    expect(kase.labels).toEqual([]);
    expect(
      kase.timeline.some((event) => event.eventType === "CASE_LABEL_CHANGED"),
    ).toBe(false);
    expect(await db.collection("case_groups").countDocuments()).toBe(0);
  });
  it("uses changes to the stored workflow config without changing application code", async () => {
    const config = structuredClone(dedupeTab["page-type"].configuration);
    config.groupBy.push({ name: "status", value: "$case.currentStatus" });
    await db.collection("workflows").updateOne(
      { code: "frps-private-beta" },
      {
        $set: {
          "pages.case-list.tabs.duplicates.page-type.configuration": config,
        },
      },
    );
    expect((await summary()).total).toBe(3);
    config.scope.stage = "REVIEW_OFFER";
    config.scope.excludeStatuses = [];
    await db.collection("workflows").updateOne(
      { code: "frps-private-beta" },
      {
        $set: {
          "pages.case-list.tabs.duplicates.page-type.configuration": config,
        },
      },
    );
    expect((await summary()).total).toBe(0);
  });
  it("enforces workflow access and read versus write permission", async () => {
    const url = await groupUrl();
    actor = User.createMock({ idpRoles: [IdpRoles.Read], appRoles: {} });
    expect((await request("GET", url)).data.canEdit).toBe(false);
    await request("PUT", url, { assignee: null, labels: {} }, 403);
    await db
      .collection("workflows")
      .updateOne(
        { code: "frps-private-beta" },
        { $set: { requiredRoles: { allOf: ["SECRET_ROLE"], anyOf: [] } } },
      );
    await request("GET", base, undefined, 403);
    await request("GET", url, undefined, 403);
  });
});
