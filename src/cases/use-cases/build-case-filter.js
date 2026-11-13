import Boom from "@hapi/boom";
import { createRoleFilter } from "./create-role-filter.js";
import { findWorkflowCodesUseCase } from "./find-workflow-codes.use-case.js";

export const buildCaseFilter = async ({ user, caseType }) => {
  const roleFilter = createRoleFilter(user.getRoles());
  const permittedCodes = await findWorkflowCodesUseCase(roleFilter);

  if (!caseType) {
    return { workflowCodes: permittedCodes };
  }

  const matchingCodes = await findWorkflowCodesUseCase({ codes: [caseType] });

  if (!matchingCodes.includes(caseType)) {
    throw Boom.notFound(`Case type "${caseType}" not found`);
  }

  if (!permittedCodes.includes(caseType)) {
    throw Boom.forbidden(
      `User does not have the required roles for case type "${caseType}"`,
    );
  }

  return { workflowCodes: [caseType] };
};
