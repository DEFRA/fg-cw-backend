import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WorkflowEndpoint } from "./workflow-endpoint.js";
import { WorkflowExternalAction } from "./workflow-external-action.js";
import { Workflow } from "./workflow.js";

describe("Workflow.fromDefinition", () => {
  const status = (code, targets = []) => ({
    code,
    name: code,
    theme: "INFO",
    description: null,
    interactive: true,
    transitions: targets.map((targetPosition) => ({
      targetPosition,
      checkTasks: false,
      action: null,
    })),
  });

  const stage = (code, statuses) => ({
    code,
    name: code,
    description: null,
    taskGroups: [],
    statuses,
  });

  const definition = (overrides = {}) => ({
    code: "frps-private-beta",
    requiredRoles: { allOf: ["ROLE_SFI_REFORM"], anyOf: [] },
    pages: {
      cases: {
        details: {
          tabs: {
            "case-details": { content: [] },
            calculations: {
              content: [],
              action: { rulesData: "FETCH_RULES" },
            },
          },
        },
      },
    },
    phases: [
      {
        code: "PRE_AWARD",
        name: "Pre award",
        stages: [
          stage("REVIEW", [
            status("RECEIVED", ["PRE_AWARD:REVIEW:APPROVED"]),
            status("APPROVED", ["POST_AWARD:MONITOR:ACTIVE"]),
          ]),
        ],
      },
      {
        code: "POST_AWARD",
        name: "Post award",
        stages: [stage("MONITOR", [status("ACTIVE")])],
      },
    ],
    endpoints: [
      {
        code: "FETCH_RULES_ENDPOINT",
        service: "RULES_ENGINE",
        path: "/api/v1/rules/{runId}",
        method: "GET",
      },
    ],
    externalActions: [
      {
        code: "FETCH_RULES",
        name: "Fetch rules",
        display: false,
        endpoint: { code: "FETCH_RULES_ENDPOINT" },
        target: null,
      },
    ],
    ...overrides,
  });

  const fromDefinition = (published) => () =>
    Workflow.fromDefinition(published, "1.2.3");

  it("uses the closest defined roles for a task or stage", () => {
    const published = definition();
    const phase = published.phases[0];
    const stage = phase.stages[0];
    phase.requiredRoles = { allOf: ["ROLE_PHASE"], anyOf: [] };
    stage.requiredRoles = { allOf: ["ROLE_STAGE"], anyOf: [] };
    const workflow = fromDefinition(published)();
    const position = workflow.getInitialPosition();
    const task = { requiredRoles: { allOf: ["ROLE_TASK"], anyOf: [] } };
    expect(workflow.getApplicableRoles(position, task)).toEqual(
      task.requiredRoles,
    );
    task.requiredRoles = { allOf: [], anyOf: [] };
    expect(workflow.getApplicableRoles(position, task)).toEqual(
      stage.requiredRoles,
    );
    expect(workflow.getApplicableRoles(position)).toEqual(stage.requiredRoles);
    workflow.getStage(position).requiredRoles = { allOf: [], anyOf: [] };
    expect(workflow.getApplicableRoles(position)).toEqual(phase.requiredRoles);
    workflow.findPhase(position.phaseCode).requiredRoles = {
      allOf: [],
      anyOf: [],
    };
    expect(workflow.getApplicableRoles(position, task)).toEqual(
      workflow.requiredRoles,
    );
  });

  const withStatuses = (statuses) => {
    const published = definition();
    published.phases[0].stages[0].statuses = statuses;
    return published;
  };

  it("builds a workflow from a published definition", () => {
    const workflow = fromDefinition(definition())();

    expect(workflow).toBeInstanceOf(Workflow);
    expect(workflow.getInitialPosition().toString()).toBe(
      "PRE_AWARD:REVIEW:RECEIVED",
    );
    expect(workflow.findEndpoint("FETCH_RULES_ENDPOINT")).toBeInstanceOf(
      WorkflowEndpoint,
    );
    expect(workflow.findExternalAction("FETCH_RULES")).toBeInstanceOf(
      WorkflowExternalAction,
    );
  });

  // The config catalog owns the version, so a definition cannot set its own.
  it("stamps the version it is given", () => {
    expect(fromDefinition(definition({ version: "9.9.9" }))().version).toBe(
      "1.2.3",
    );
  });

  it("accepts a definition with no endpoints, external actions or tab actions", () => {
    const published = definition({ pages: {} });
    delete published.endpoints;
    delete published.externalActions;

    expect(fromDefinition(published)).not.toThrow();
  });

  it("accepts the published pigs-might-fly definition", () => {
    const published = JSON.parse(
      readFileSync(
        join(
          import.meta.dirname,
          "../../../test/fixtures/workflow-definitions/pigs-might-fly.cw.json",
        ),
        "utf8",
      ),
    );

    expect(fromDefinition(published)).not.toThrow();
  });

  it.each([null, "a string", []])("rejects %j", (published) => {
    expect(fromDefinition(published)).toThrow(/^Invalid Workflow/);
  });

  it.each([
    ["no code", { code: undefined }, '"code" is required'],
    [
      "a code with characters other than letters, digits and hyphens",
      { code: "frps private beta" },
      '"code" with value "frps private beta" fails to match the required pattern',
    ],
    [
      "an _id that is not an ObjectId",
      { _id: "not-an-object-id" },
      '"_id" must only contain hexadecimal characters',
    ],
    [
      "no required roles",
      { requiredRoles: undefined },
      '"requiredRoles" is required',
    ],
    [
      "required roles with no anyOf",
      { requiredRoles: { allOf: [] } },
      '"requiredRoles.anyOf" is required',
    ],
    [
      "a required role that is not a role code",
      { requiredRoles: { allOf: ["role_pmf"], anyOf: [] } },
      '"requiredRoles.allOf[0]" with value "role_pmf" fails to match the required pattern',
    ],
    [
      "phases that are not a list",
      { phases: "PRE_AWARD" },
      '"phases" must be an array',
    ],
    ["no phases", { phases: undefined }, '"phases" is required'],
  ])("rejects a definition with %s", (_, overrides, reason) => {
    expect(fromDefinition(definition(overrides))).toThrow(reason);
  });

  it.each([
    ["a phase", "phases", "PRE_AWARD"],
    ["an endpoint", "endpoints", "FETCH_RULES_ENDPOINT"],
    ["an external action", "externalActions", "FETCH_RULES"],
  ])("rejects %s code used twice", (_, key, code) => {
    const published = definition();
    published[key].push(published[key][0]);

    expect(fromDefinition(published)).toThrow(
      `Invalid Workflow "frps-private-beta": "${key}[${published[key].length - 1}]" repeats code "${code}"`,
    );
  });

  it("rejects a phase that its own rules reject", () => {
    const published = withStatuses([status("RECEIVED"), status("RECEIVED")]);

    expect(fromDefinition(published)).toThrow(
      'Invalid WorkflowStage "REVIEW": "statuses[1]" repeats code "RECEIVED"',
    );
  });

  it("rejects an endpoint that its own rules reject", () => {
    const published = definition();
    published.endpoints[0].method = "FETCH";

    expect(fromDefinition(published)).toThrow(
      'Invalid WorkflowEndpoint "FETCH_RULES_ENDPOINT"',
    );
  });

  it("rejects an external action whose endpoint the workflow does not define", () => {
    const published = definition({ endpoints: [] });

    expect(fromDefinition(published)).toThrow(
      'Invalid WorkflowExternalAction "FETCH_RULES": endpoint "FETCH_RULES_ENDPOINT" is not one of the workflow\'s endpoints',
    );
  });

  it("rejects a tab action that names no external action", () => {
    const published = definition();
    published.pages.cases.details.tabs.calculations.action.extra =
      "MISSING_ACTION";

    expect(fromDefinition(published)).toThrow(
      'Invalid Workflow "frps-private-beta": tab "calculations" action "extra" names external action "MISSING_ACTION", which is not defined',
    );
  });

  it("rejects a definition with no phases in its list", () => {
    expect(fromDefinition(definition({ phases: [] }))).toThrow(
      'Invalid Workflow "frps-private-beta": it has no initial position, its first phase needs a stage with a status',
    );
  });

  it("rejects a first phase with no stages", () => {
    const published = definition();
    published.phases[0].stages = [];

    expect(fromDefinition(published)).toThrow("has no initial position");
  });

  it("rejects a first status with no code", () => {
    expect(
      fromDefinition(
        withStatuses([{ ...status("RECEIVED"), code: undefined }]),
      ),
    ).toThrow('"statuses[0].code" is required');
  });

  it("rejects a first stage with no statuses", () => {
    expect(fromDefinition(withStatuses([]))).toThrow("has no initial position");
  });

  it("rejects transitions to positions the workflow does not contain, naming each", () => {
    const published = withStatuses([
      status("RECEIVED", [
        "PRE_AWARD:REVIEW:MISSING_STATUS",
        "PRE_AWARD:MISSING_STAGE:RECEIVED",
        "MISSING_PHASE:REVIEW:RECEIVED",
        "PRE_AWARD:REVIEW:RECEIVED",
      ]),
    ]);

    expect(fromDefinition(published)).toThrow(
      'Invalid Workflow "frps-private-beta": it has transitions to positions it does not contain: ' +
        "PRE_AWARD:REVIEW:RECEIVED -> PRE_AWARD:REVIEW:MISSING_STATUS, " +
        "PRE_AWARD:REVIEW:RECEIVED -> PRE_AWARD:MISSING_STAGE:RECEIVED, " +
        "PRE_AWARD:REVIEW:RECEIVED -> MISSING_PHASE:REVIEW:RECEIVED",
    );
  });

  // The runtime stores a definition's targets as written, so a partial target
  // that the admin route would resolve moves a case nowhere.
  it("rejects a partial target position", () => {
    const published = withStatuses([status("RECEIVED", ["::RECEIVED"])]);

    expect(fromDefinition(published)).toThrow(
      "PRE_AWARD:REVIEW:RECEIVED -> ::RECEIVED",
    );
  });

  it("fails with a Boom, so the failure is known to be permanent", () => {
    let error;
    try {
      fromDefinition(definition({ phases: [] }))();
    } catch (e) {
      error = e;
    }

    expect(error.isBoom).toBe(true);
  });
});
