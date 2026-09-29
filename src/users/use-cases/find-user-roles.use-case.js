import { findByIdpId } from "../repositories/user.repository.js";

// Exposes a user's roles to calling systems outside caseworking (FGP-1432).
//
// An unknown user and a known user with no active roles both return the same
// empty payload, on purpose. Distinguishing them - a 404, say - would confirm
// whether an account exists to anyone holding a service token, which is the
// implicit information this endpoint is required not to leak.
export const findUserRolesUseCase = async ({ entraId }) => {
  const user = await findByIdpId(entraId);

  if (!user) {
    return { appRoles: [] };
  }

  // getRoles() already filters to roles active today via AppRole.isActive().
  const appRoles = user.getRoles().map((roleName) => {
    const { startDate, endDate } = user.appRoles[roleName];

    // Internal startDate/endDate are mapped to the published from/to names, and
    // absent dates are normalised to null - left undefined they would be
    // dropped from the JSON entirely rather than serialised as null.
    return {
      roleName,
      from: startDate ?? null,
      to: endDate ?? null,
    };
  });

  return { appRoles };
};
