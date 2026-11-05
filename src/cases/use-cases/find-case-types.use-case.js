import { AccessControl } from "../../common/access-control.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { RequiredAppRoles } from "../models/required-app-roles.js";
import { findWorkflowCodesUseCase } from "./find-workflow-codes.use-case.js";

export const findCaseTypesUseCase = async ({ user }) => {
  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  const codes = await findWorkflowCodesUseCase();

  return codes
    .sort((a, b) => a.localeCompare(b))
    .map((code) => ({ code }));
};
