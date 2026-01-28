import { RequiredAppRoles } from "../../cases/models/required-app-roles.js";
import { AccessControl } from "../../common/access-control.js";
import { PageViewModel } from "../../common/view-models/page.view-model.js";
import { IdpRoles } from "../models/idp-roles.js";
import { findAll } from "../repositories/user.repository.js";

export const adminFindUsersUseCase = async ({ user, query = {} }) => {
  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  const users = await findAll(query);

  return new PageViewModel({
    user,
    data: users,
  });
};
