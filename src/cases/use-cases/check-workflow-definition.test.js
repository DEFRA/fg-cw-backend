import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { checkWorkflowDefinition } from "./check-workflow-definition.js";

vi.mock("../../common/mongo-client.js", () => ({ db: {}, mongoClient: {} }));

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

const readDefinition = (path) =>
  JSON.parse(readFileSync(join(REPO_ROOT, path), "utf8"));

const status = (code, transitions = []) => ({
  code,
  name: code,
  transitions: transitions.map((targetPosition) => ({ targetPosition })),
});

const aDefinition = (overrides = {}) => ({
  code: "woodland",
  requiredRoles: { allOf: [], anyOf: [] },
  phases: [
    {
      code: "PRE_AWARD",
      name: "Pre award",
      stages: [
        {
          code: "REVIEW",
          name: "Review",
          taskGroups: [],
          statuses: [
            status("RECEIVED", ["PRE_AWARD:REVIEW:APPROVED"]),
            status("APPROVED", ["POST_AWARD:MONITOR:ACTIVE"]),
          ],
        },
      ],
    },
    {
      code: "POST_AWARD",
      name: "Post award",
      stages: [
        {
          code: "MONITOR",
          name: "Monitor",
          taskGroups: [],
          statuses: [status("ACTIVE")],
        },
      ],
    },
  ],
  ...overrides,
});

const check =
  (definition, grantCode = "woodland") =>
  () =>
    checkWorkflowDefinition(definition, { grantCode, version: "1.2.3" });

const withFirstStage = (stage) => {
  const definition = aDefinition();
  definition.phases[0].stages[0] = {
    ...definition.phases[0].stages[0],
    ...stage,
  };
  return definition;
};

describe("checkWorkflowDefinition", () => {
  it("accepts a definition cases can use", () => {
    expect(check(aDefinition())).not.toThrow();
  });

  it.each([
    ["compose/seed/pigs-might-fly/1.0.0/cw/cw.json", "pigs-might-fly"],
    ["compose/seed/pigs-might-fly/1.0.1/cw/cw.json", "pigs-might-fly"],
    ["compose/seed/woodland/1.0.0/cw/cw.json", "woodland"],
    ["compose/seed/woodland/1.0.1/cw/cw.json", "woodland"],
  ])("accepts the published-shape definition %s", (path, grantCode) => {
    expect(check(readDefinition(path), grantCode)).not.toThrow();
  });

  it("accepts a definition whose code differs from the grant", () => {
    expect(
      check(aDefinition({ code: "frps-private-beta" }), "farm-payments"),
    ).not.toThrow();
  });

  it("rejects a definition with no phases", () => {
    expect(check(aDefinition({ phases: [] }))).toThrow(
      "has no initial position",
    );
  });

  it("rejects a first phase with no stages", () => {
    const definition = aDefinition();
    definition.phases[0].stages = [];

    expect(check(definition)).toThrow("has no initial position");
  });

  it("rejects a first stage with no statuses", () => {
    expect(check(withFirstStage({ statuses: [] }))).toThrow(
      "has no initial position",
    );
  });

  it("rejects transitions to positions the workflow does not contain, naming each", () => {
    const definition = withFirstStage({
      statuses: [
        status("RECEIVED", [
          "PRE_AWARD:REVIEW:MISSING_STATUS",
          "PRE_AWARD:MISSING_STAGE:RECEIVED",
          "MISSING_PHASE:REVIEW:RECEIVED",
          "PRE_AWARD:REVIEW:RECEIVED",
        ]),
      ],
    });

    expect(check(definition)).toThrow(
      "has transitions to positions it does not contain: " +
        "PRE_AWARD:REVIEW:RECEIVED -> PRE_AWARD:REVIEW:MISSING_STATUS, " +
        "PRE_AWARD:REVIEW:RECEIVED -> PRE_AWARD:MISSING_STAGE:RECEIVED, " +
        "PRE_AWARD:REVIEW:RECEIVED -> MISSING_PHASE:REVIEW:RECEIVED",
    );
  });

  // The runtime stores a definition's targets as written, so a partial target
  // that the admin route would resolve moves a case nowhere.
  it("rejects a partial target position", () => {
    const definition = withFirstStage({
      statuses: [status("RECEIVED", ["::RECEIVED"])],
    });

    expect(check(definition)).toThrow(
      "PRE_AWARD:REVIEW:RECEIVED -> ::RECEIVED",
    );
  });

  it.each([
    [
      "a malformed target position",
      withFirstStage({ statuses: [status("RECEIVED", ["not a position"])] }),
    ],
    ["no required roles", aDefinition({ requiredRoles: undefined })],
    ["phases that are not a list", aDefinition({ phases: "PRE_AWARD" })],
    [
      "a status with no transitions",
      withFirstStage({ statuses: [{ code: "RECEIVED" }] }),
    ],
    ["a stage with no task groups", withFirstStage({ taskGroups: undefined })],
  ])(
    "rejects a definition with %s as one that cannot be built",
    (_, definition) => {
      expect(check(definition)).toThrow(
        "Workflow definition for woodland@1.2.3 cannot be built",
      );
    },
  );

  it.each([null, "a string", []])(
    "rejects %j as one that cannot be built",
    (definition) => {
      expect(check(definition)).toThrow("cannot be built");
    },
  );

  it("fails with a Boom 422, so the failure is known to be permanent", () => {
    let error;
    try {
      check(aDefinition({ phases: [] }))();
    } catch (e) {
      error = e;
    }

    expect(error.isBoom).toBe(true);
    expect(error.output.statusCode).toBe(422);
  });
});
