import { RequiredAppRoles } from "../../cases/models/required-app-roles.js";
import { AccessControl } from "../../common/access-control.js";
import { PageViewModel } from "../../common/view-models/page.view-model.js";
import { IdpRoles } from "../models/idp-roles.js";
import { findUserByIdUseCase } from "./find-user-by-id.use-case.js";

export const adminFindUserByIdUseCase = async ({ user, userId }) => {
  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  const foundUser = await findUserByIdUseCase(userId);

  return new PageViewModel({
    user,
    data: foundUser,
  });
};
