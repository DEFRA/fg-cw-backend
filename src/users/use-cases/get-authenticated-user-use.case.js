import Boom from "@hapi/boom";
import { findByIdpId } from "../repositories/user.repository.js";

export const getAuthenticatedUserUseCase = async (idpId) => {
  const user = await findByIdpId(idpId);
  if (!user) {
    throw Boom.forbidden("User not found in application database");
  }

  return user;
};
