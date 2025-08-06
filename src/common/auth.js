// TODO: this is a stub. Replace when auth has been implemented.
export const getAuthenticatedUserRoles = () => ({
  ROLE_RPA: {},
  ROLE_RPA_ADMIN: {},
  ROLE_FLYING_PIGS: {},
  ROLE_1: {},
  ROLE_2: {},
  ROLE_3: {},
});

export const getAuthenticatedUser = () => {
  // TODO: This user should be coming from the JWT token
  return {
    id: "System",
    name: "System",
    email: "system@example.com",
  };
};
