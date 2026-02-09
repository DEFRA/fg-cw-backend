import Boom from "@hapi/boom";
import { randomUUID } from "crypto";
import { RequiredAppRoles } from "../../cases/models/required-app-roles.js";
import { AccessControl } from "../../common/access-control.js";
import { logger } from "../../common/logger.js";
import { IdpRoles } from "../models/idp-roles.js";
import { User } from "../models/user.js";
import { findByEmail, save } from "../repositories/user.repository.js";

export const adminCreateUserUseCase = async ({ user, props }) => {
  logger.info("Creating user manually");

  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  const existingUser = await findByEmail(props.email);
  if (existingUser) {
    throw Boom.conflict("A user with this email address already exists");
  }

  const now = new Date().toISOString();

  const newUser = new User({
    idpId: randomUUID(),
    name: props.name,
    email: props.email,
    idpRoles: [],
    appRoles: {},
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    createdManually: true,
  });

  await save(newUser);

  logger.info(`Finished: Creating user manually with id ${newUser.id}`);

  return newUser;
};
