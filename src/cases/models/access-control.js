import Boom from "@hapi/boom";

export class AccessControl {
  constructor(user) {
    this.appRoles = this.getValidRoles(user.appRoles || {});
  }

  authorise(requiredRoles) {
    if (!this.canAccess(requiredRoles)) {
      throw Boom.forbidden("Access denied");
    }
    return true;
  }

  canAccess(requiredRoles) {
    return (
      this.hasAllRequiredRoles(requiredRoles.allOf, this.appRoles) &&
      this.hasAnyRequiredRole(requiredRoles.anyOf, this.appRoles)
    );
  }

  hasAllRequiredRoles(requiredRoles, userRoles) {
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    return requiredRoles.every((role) => userRoles.includes(role));
  }

  hasAnyRequiredRole(requiredRoles, userRoles) {
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    return requiredRoles.some((role) => userRoles.includes(role));
  }

  getValidRoles(appRoles) {
    const now = new Date();
    const validRoles = [];

    for (const [roleName, roleData] of Object.entries(appRoles)) {
      if (this.isRoleValid(roleData, now)) {
        validRoles.push(roleName);
      }
    }

    return validRoles;
  }

  isRoleValid(roleData, currentDate) {
    if (!roleData.startDate || !roleData.endDate) {
      return false;
    }

    const startDateStr = roleData.startDate + "T00:00:00.000Z";
    const endDateStr = roleData.endDate + "T23:59:59.999Z";

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    return currentDate >= startDate && currentDate <= endDate;
  }
}
