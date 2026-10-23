import { orNull } from "../actuator-box.repository.js";

export const toWorkflowSummary = ({ schemeName, requiredRoles }) => ({
  schemeName: orNull(schemeName),
  requiredRoles: { allOf: requiredRoles.allOf, anyOf: requiredRoles.anyOf },
});
