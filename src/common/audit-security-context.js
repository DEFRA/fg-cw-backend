const summariseAppRoles = (appRoles = {}) =>
  Object.fromEntries(
    Object.entries(appRoles).map(([code, role]) => [
      code,
      { startDate: role.startDate, endDate: role.endDate },
    ]),
  );

export const buildActorSummary = (user) => ({
  id: user.id,
  idpId: user.idpId,
  name: user.name,
  email: user.email,
  idpRoles: user.idpRoles,
});

export const buildUserSummary = (user) => ({
  ...buildActorSummary(user),
  appRoles: summariseAppRoles(user.appRoles),
});

export const buildSecurityContext = (actor, targetUser) => {
  const security = { actor: buildActorSummary(actor) };

  if (targetUser) {
    security.targetUser = buildUserSummary(targetUser);
  }

  return security;
};
