import Boom from "@hapi/boom";
import { buildFromDefinition } from "../repositories/workflow.repository.js";

// Checks the workflow a case would actually get, not the POST /workflows request
// schema, which rejects definitions the runtime serves happily.
const build = (definition, { version, label }) => {
  try {
    return buildFromDefinition(definition, version);
  } catch (error) {
    throw Boom.badData(
      `Workflow definition for ${label} cannot be built: ${error.message}`,
    );
  }
};

const initialPositionOf = (workflow) => {
  const phase = workflow.phases[0];
  const stage = phase?.stages[0];
  const status = stage?.statuses[0];

  return [phase, stage, status];
};

const assertInitialPosition = (workflow, { label }) => {
  if (!initialPositionOf(workflow).every((node) => node?.code)) {
    throw Boom.badData(
      `Workflow definition for ${label} has no initial position: its first phase needs a stage with a status`,
    );
  }
};

const resolves = (workflow, { phaseCode, stageCode, statusCode }) =>
  workflow.phases.some(
    (phase) =>
      phase.code === phaseCode &&
      phase.stages.some(
        (stage) =>
          stage.code === stageCode &&
          stage.statuses.some((status) => status.code === statusCode),
      ),
  );

const transitionsOf = (workflow) =>
  workflow.phases.flatMap((phase) =>
    phase.stages.flatMap((stage) =>
      stage.statuses.flatMap((status) =>
        status.transitions.map((transition) => ({
          from: `${phase.code}:${stage.code}:${status.code}`,
          to: transition.targetPosition,
        })),
      ),
    ),
  );

const assertTransitionTargetsResolve = (workflow, { label }) => {
  const unresolved = transitionsOf(workflow)
    .filter(({ to }) => !resolves(workflow, to))
    .map(({ from, to }) => `${from} -> ${to}`);

  if (unresolved.length > 0) {
    throw Boom.badData(
      `Workflow definition for ${label} has transitions to positions it does not contain: ${unresolved.join(", ")}`,
    );
  }
};

export const checkWorkflowDefinition = (definition, { grantCode, version }) => {
  const context = { version, label: `${grantCode}@${version}` };
  const workflow = build(definition, context);

  assertInitialPosition(workflow, context);
  assertTransitionTargetsResolve(workflow, context);
};
