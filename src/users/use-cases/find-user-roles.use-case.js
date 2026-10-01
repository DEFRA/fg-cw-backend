import { logger } from "../../common/logger.js";
import { findByIdpId } from "../repositories/user.repository.js";

// `?? null` is load-bearing: undefined dates are dropped by JSON.stringify
// rather than serialised as the null the response contract promises.
const toResponseRoles = (user) =>
  user.getRoles().map((roleName) => {
    const { startDate, endDate } = user.appRoles[roleName];

    return { roleName, from: startDate ?? null, to: endDate ?? null };
  });

export const findUserRolesUseCase = async ({ entraId }) => {
  logger.info(`Finding roles for User with idpId: "${entraId}"`);

  const user = await findByIdpId(entraId);

  // An unknown user returns the same empty payload as a known user with no
  // active roles, so a caller cannot probe whether an account exists. The logs
  // are therefore the only place that distinction survives for support.
  const appRoles = user ? toResponseRoles(user) : [];

  if (user) {
    logger.debug(
      `Found ${appRoles.length} active role(s) for User with idpId: "${entraId}"`,
    );
  } else {
    logger.info(`No User found with idpId: "${entraId}"`);
  }

  logger.info(`Finished: Finding roles for User with idpId: "${entraId}"`);

  return { appRoles };
};
