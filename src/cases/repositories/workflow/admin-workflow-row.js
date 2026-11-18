import { orNull } from "../actuator-box.repository.js";

export const toWorkflowSummary = ({ schemeName, requiredRoles }) => ({
  schemeName: orNull(schemeName),
  requiredRoles: { allOf: requiredRoles.allOf, anyOf: requiredRoles.anyOf },
});

// Lenient, as the rest of the read is: a name that is not a string is null.
const textOrNull = (value) => (typeof value === "string" ? value : null);

const listOf = (items) => (Array.isArray(items) ? items : []);

const byCode = (items, code) =>
  listOf(items).find((item) => item?.code === code);

const nameOf = (item) => textOrNull(item?.name);

const phaseNamesOf = (phases) =>
  listOf(phases).map((item) => ({
    code: textOrNull(item?.code),
    name: nameOf(item),
  }));

// Every phase, and the stage and status of the position only. A code the
// version does not have is named null.
export const toPositionNames = ({ phases }, { phase, stage, status }) => {
  const currentStage = byCode(byCode(phases, phase)?.stages, stage);

  return {
    phases: phaseNamesOf(phases),
    stage: nameOf(currentStage),
    status: nameOf(byCode(currentStage?.statuses, status)),
  };
};
