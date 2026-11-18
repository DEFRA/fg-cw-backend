import Hapi from "@hapi/hapi";
import { DedupeGroupKey } from "../src/cases/models/dedupe-group-key.js";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { performance } from "node:perf_hooks";
import { dedupePageRoutes } from "../src/cases/routes/dedupe-page.route.js";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../src/cases/repositories/case.repository.js";
import * as repository from "../src/cases/repositories/dedupe.repository.js";
import { db, mongoClient } from "../src/common/mongo-client.js";
import { requestContext } from "../src/common/request-context.js";
import { setAuditActor } from "../src/common/set-audit-actor.js";
import { IdpRoles } from "../src/users/models/idp-roles.js";
import { User } from "../src/users/models/user.js";
import { dedupeTab, seedDedupe } from "./helpers/dedupe-seed.js";

describe("configured dedupe routes, BFF and real MongoDB", () => {
  let server, seed, actor;
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
    (await summary()).rows
      .find((row) => row.details.sbi === "244666513")
      .href.replace("/types/", "/case-types/");
  const save = (url, labels = {}, assignee = "", status = 200) =>
    request(
      "PUT",
      url,
      {
        form: {
          assignee,
          ...Object.fromEntries(
            Object.entries(labels).map(([ref, value]) => [
              "label-" + ref,
              value,
            ]),
          ),
        },
      },
      status,
    );
  const detail = async (url) => (await request("GET", url)).data;
  beforeAll(async () => {
    await mongoClient.connect();
    server = Hapi.server();
    await server.register(requestContext);
    server.auth.scheme("test-user", () => ({
      authenticate: (_r, h) =>
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
  it("discovers configured tabs and renders three groups without creating assignments", async () => {
    expect((await request("GET", "/case-list-pages")).data.pages[0].title).toBe(
      "Clean the list",
    );
    const page = await summary();
    expect(page.heading).toBe("0 of 3 issues completed");
    expect(page.rows.map((row) => row.details.sbi)).toEqual([
      "244666515",
      "244666514",
      "244666513",
    ]);
    expect((await detail(await groupUrl())).rows).toHaveLength(3);
    expect(await db.collection("case_groups").countDocuments()).toBe(0);
  });
  it("persists through real Case hydration, keeps changed-only timelines, and reopens on arrival", async () => {
    const url = await groupUrl();
    expect(
      (
        await save(
          url,
          { 300241: "NOT_DUPLICATE", 300242: "DUPLICATE:300241" },
          seed.user.id,
        )
      ).changedLabels,
    ).toBe(2);
    expect((await summary()).heading).toBe("1 of 3 issues completed");
    expect(
      (
        await save(
          url,
          { 300241: "NOT_DUPLICATE", 300242: "DUPLICATE:300241" },
          seed.user.id,
        )
      ).changedLabels,
    ).toBe(0);
    const kase = await findByCaseRefAndWorkflowCode(
      "300242",
      "frps-private-beta",
    );
    expect(kase.dedupeAssessment.duplicateOf).toBe("300241");
    expect(kase).not.toHaveProperty("labels");
    expect(kase.dedupeAssessment).not.toHaveProperty("namespace");
    const assessmentChange = kase.timeline.find(
      (event) => event.eventType === "CASE_LABEL_CHANGED",
    );
    expect(assessmentChange.data).not.toHaveProperty("namespace");
    expect(assessmentChange.data.oldAssessment).toBeNull();
    expect(assessmentChange.data.newAssessment.duplicateOf).toBe("300241");
    expect(
      kase.timeline.filter((event) => event.eventType === "CASE_LABEL_CHANGED"),
    ).toHaveLength(1);
    await update(kase);
    expect(
      (await db.collection("cases").findOne({ caseRef: "300242" }))
        .dedupeAssessment.code,
    ).toBe("DUPLICATE");
    const assignment = await db.collection("case_groups").findOne({});
    expect(assignment).not.toHaveProperty("pageKey");
    expect(await db.collection("outbox").countDocuments()).toBeGreaterThan(0);
    await seed.addCase("300260", "244666513");
    expect((await summary()).heading).toBe("0 of 3 issues completed");
    expect(
      (await detail(url)).ownerField.items.find((item) => item.selected).value,
    ).toBe(seed.user.id);
  });
  it.each(["APPLICATION_WITHDRAWN", "WITHDRAWAL_REQUESTED"])(
    "supplies historical selections and read-only state after %s hides a group",
    async (status) => {
      const url = await groupUrl();
      await save(url, { 300242: "DUPLICATE:300241" });
      await db
        .collection("cases")
        .updateOne({ caseRef: "300241" }, { $set: { currentStatus: status } });
      expect((await summary()).total).toBe(2);
      const page = await detail(url);
      expect(page.rows[0].labelField.disabled).toBe(true);
      const field = page.rows.find(
        (row) => row.caseLink.text === "300242",
      ).labelField;
      expect(field.items.find((item) => item.selected).text).toBe(
        "Duplicate with 300241 (historical target)",
      );
      expect(
        (await save(url, { 300242: "DUPLICATE:300241" }, seed.user.id))
          .changedLabels,
      ).toBe(0);
      await save(url, { 300241: "NOT_DUPLICATE" }, "", 400);
    },
  );
  it("rejects invalid input before writes and returns a complete BFF error page", async () => {
    const url = await groupUrl();
    for (const labels of [
      { 300244: "NOT_DUPLICATE" },
      { 300241: "DUPLICATE:300241" },
      { 300241: "DUPLICATE:300243" },
      { 300241: "invalid-token" },
    ]) {
      const result = await save(url, labels, seed.user.id, 400);
      expect(result.page.data.rows).toHaveLength(3);
      expect(result.page.data.errorList[0].href).toMatch(/^#label-/);
    }
    await save(url, {}, "000000000000000000000000", 400);
    expect(await db.collection("case_groups").countDocuments()).toBe(0);
    expect(
      (await db.collection("cases").findOne({ caseRef: "300241" }))
        .dedupeAssessment,
    ).toBeNull();
  });
  it("rejects cycles in the final submission and through historical out-of-scope references", async () => {
    const url = await groupUrl();
    await save(
      url,
      { 300241: "DUPLICATE:300242", 300242: "DUPLICATE:300241" },
      "",
      400,
    );
    await seed.addCase("300260", "244666513");
    await save(
      url,
      {
        300241: "DUPLICATE:300242",
        300242: "DUPLICATE:300260",
        300260: "DUPLICATE:300241",
      },
      "",
      400,
    );
    await db.collection("cases").updateOne(
      { caseRef: "300260" },
      {
        $set: {
          currentStage: "REVIEW_OFFER",
          dedupeAssessment: { code: "DUPLICATE", duplicateOf: "300241" },
        },
      },
    );
    await db.collection("cases").updateOne(
      { caseRef: "300242" },
      {
        $set: {
          dedupeAssessment: { code: "DUPLICATE", duplicateOf: "300260" },
        },
      },
    );
    await save(url, { 300241: "DUPLICATE:300242" }, "", 400);
  });
  it("clears the assessment without changing unrelated case data or creating an owner", async () => {
    const url = await groupUrl();
    await db
      .collection("cases")
      .updateOne(
        { caseRef: "300241" },
        { $set: { "payload.answers.otherReview": "REVIEWED" } },
      );
    await save(url, { 300241: "NOT_DUPLICATE" });
    await save(url, { 300241: "" });
    expect((await save(url, { 300241: "" })).changedLabels).toBe(0);
    const kase = await db.collection("cases").findOne({ caseRef: "300241" });
    expect(kase.dedupeAssessment).toBeNull();
    expect(kase.payload.answers.otherReview).toBe("REVIEWED");
    expect(kase).not.toHaveProperty("labels");
    expect(
      kase.timeline.filter((event) => event.eventType === "CASE_LABEL_CHANGED"),
    ).toHaveLength(2);
    expect(await db.collection("case_groups").countDocuments()).toBe(0);
  });
  it("rolls back the combined save when the owner write fails", async () => {
    const url = await groupUrl();
    vi.spyOn(repository, "saveGroupOwner").mockRejectedValueOnce(
      new Error("Forced owner failure"),
    );
    await save(url, { 300241: "NOT_DUPLICATE" }, seed.user.id, 500);
    const kase = await db.collection("cases").findOne({ caseRef: "300241" });
    expect(kase.dedupeAssessment).toBeNull();
    expect(
      kase.timeline.some((event) => event.eventType === "CASE_LABEL_CHANGED"),
    ).toBe(false);
  });
  it("changes grouping and scope through stored configuration only", async () => {
    const config = structuredClone(dedupeTab["page-type"].configuration);
    config.groupBy.push({ name: "reference", value: "$case.caseRef" });
    await db.collection("workflows").updateOne(
      { code: "frps-private-beta", version: "1.0.0" },
      {
        $set: {
          "pages.case-list.tabs.duplicates.page-type.configuration": config,
        },
      },
    );
    expect((await summary()).total).toBe(0);
    config.groupBy = dedupeTab["page-type"].configuration.groupBy;
    config.scope.stage = "REVIEW_OFFER";
    config.scope.excludeStatuses = [];
    await db.collection("workflows").updateOne(
      { code: "frps-private-beta", version: "1.0.0" },
      {
        $set: {
          "pages.case-list.tabs.duplicates.page-type.configuration": config,
        },
      },
    );
    expect((await summary()).total).toBe(0);
  });
  it("handles absent optional sources and literal display config without projecting payload", async () => {
    const config = structuredClone(dedupeTab["page-type"].configuration);
    config.data.details.businessName =
      "function:first(@.cases, '$case.payload.answers.applicant.business.optionalName')";
    const replace = () =>
      db.collection("workflows").updateOne(
        { code: "frps-private-beta", version: "1.0.0" },
        {
          $set: {
            "pages.case-list.tabs.duplicates.page-type.configuration": config,
          },
        },
      );
    await replace();
    expect((await summary()).rows[0].details.businessName).toBeNull();
    config.data.details.businessName = "Configured farm";
    await replace();
    expect((await summary()).rows[0].details.businessName).toBe(
      "Configured farm",
    );
    expect((await detail(await groupUrl())).intro).toBe(
      "Configured farm · 3 applications",
    );
  });
  it("enforces workflow permissions and supplies disabled fields to read-only users", async () => {
    const url = await groupUrl();
    actor = User.createMock({ idpRoles: [IdpRoles.Read], appRoles: {} });
    const page = await detail(url);
    expect(page.ownerField.disabled).toBe(true);
    expect(page.rows.every((row) => row.labelField.disabled)).toBe(true);
    expect(page.saveButton).toBeNull();
    await save(url, {}, "", 403);
    await db
      .collection("workflows")
      .updateOne(
        { code: "frps-private-beta" },
        { $set: { requiredRoles: { allOf: ["SECRET_ROLE"], anyOf: [] } } },
      );
    await request("GET", base, undefined, 403);
  });
  it("handles 5,000 mostly unique cases with sparse duplicates and narrow detail projections", async () => {
    const documents = Array.from({ length: 5000 }, (_, i) => ({
      workflowCode: "frps-private-beta",
      caseRef: "unique-" + i,
      currentPhase: "PRE_AWARD",
      currentStage: "REVIEW_APPLICATION",
      currentStatus: "IN_REVIEW",
      createdAt: new Date(),
      dedupeAssessment: null,
      payload: {
        identifiers: { sbi: "unique-" + i },
        answers: { applicant: { business: { name: "Unique farm " + i } } },
        unrelatedData: "x".repeat(2000),
      },
    }));
    await db.collection("cases").insertMany(documents);
    const plan = await db
      .collection("cases")
      .find({
        workflowCode: "frps-private-beta",
        currentPhase: "PRE_AWARD",
        currentStage: "REVIEW_APPLICATION",
        "payload.identifiers.sbi": "244666513",
      })
      .explain("executionStats");
    expect(JSON.stringify(plan.queryPlanner.winningPlan)).toContain("IXSCAN");
    expect(plan.executionStats.nReturned).toBe(3);
    expect(plan.executionStats.totalDocsExamined).toBe(3);
    const started = performance.now();
    expect((await summary()).total).toBe(3);
    const elapsed = performance.now() - started;
    const page = await detail(await groupUrl());
    expect(page.rows).toHaveLength(3);
    expect(JSON.stringify(page)).not.toContain("unrelatedData");
    const compiled = seed.workflow.validateCaseListPages().duplicates;
    const members = await repository.findDedupeMembers(
      new DedupeGroupKey("frps-private-beta", { sbi: "244666513" }),
      compiled,
    );
    expect(members).toHaveLength(3);
    expect(members[0]).not.toHaveProperty("payload");
    expect(members[0].source).toEqual({ s0: "Farm 244666513" });
    process.stdout.write(
      `Sparse-dedupe evidence: 5,010 cases; 3 visible groups; summary ${elapsed.toFixed(0)} ms (local observation, not an SLA).\n`,
    );
  });
});
