const DEFAULT_ROLES = {
  ROLE_RPA: {},
  ROLE_RPA_ADMIN: {},
  ROLE_FLYING_PIGS: {},
  ROLE_1: {},
  ROLE_2: {},
  ROLE_3: {},
};

const DEFAULT_USER = {
  id: "System",
  name: "System",
  email: "system@example.com",
};

const convertRolesToObject = (roles) => {
  return roles.reduce((acc, role) => {
    acc[role] = {};
    return acc;
  }, {});
};

export const getAuthenticatedUserRoles = (auth) => {
  try {
    const idpRoles = auth.credentials.raw.idpRoles;
    return idpRoles ? convertRolesToObject(idpRoles) : DEFAULT_ROLES;
  } catch {
    return DEFAULT_ROLES;
  }
};

export const getAuthenticatedUser = (user) => {
  try {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  } catch {
    return DEFAULT_USER;
  }
};
