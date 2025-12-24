import Boom from "@hapi/boom";

export class AccessControl {
  static authorise(user, requirements) {
    if (!this.canAccess(user, requirements)) {
      throw Boom.forbidden(
        `User ${user.id} does not have required roles to perform action`,
      );
    }

    return true;
  }

  static canAccess(user, requirements) {
    if (!user) {
      return false;
    }

    const hasIdpAccess = this.#hasIdpRoles(user, requirements.idpRoles);
    const hasAppAccess = this.#hasAppRoles(user, requirements.appRoles);

    return hasIdpAccess && hasAppAccess;
  }

  static #hasIdpRoles(user, roles) {
    if (!Array.isArray(roles)) {
      throw Boom.badImplementation("idpRoles not supplied");
    }

    if (roles.length === 0) {
      return true;
    }

    return roles.some((role) => user.hasIdpRole(role));
  }

  static #hasAppRoles(user, appRoles) {
    const hasAllOf = this.#hasAllAppRoles(user, appRoles?.allOf);
    const hasAnyOf = this.#hasAnyAppRole(user, appRoles?.anyOf);

    return hasAllOf && hasAnyOf;
  }

  static #hasAllAppRoles(user, roles) {
    if (!Array.isArray(roles)) {
      throw Boom.badImplementation("appRoles.allOf not supplied");
    }

    return roles.every((role) => user.hasActiveRole(role));
  }

  static #hasAnyAppRole(user, roles) {
    if (!Array.isArray(roles)) {
      throw Boom.badImplementation("appRoles.anyOf not supplied");
    }

    if (roles.length === 0) {
      return true;
    }

    return roles.some((role) => user.hasActiveRole(role));
  }
}
