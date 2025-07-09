export class Permissions {
  constructor(props) {
    this.allOf = props.allOf || [];
    this.anyOf = props.anyOf || [];
  }

  isAuthorised(roles) {
    return this.hasAllRequiredRoles(roles) && this.hasAnyRequiredRole(roles);
  }

  hasAllRequiredRoles(roles) {
    if (this.allOf.length === 0) {
      return true;
    }

    return this.allOf.every((role) => roles.includes(role));
  }

  hasAnyRequiredRole(roles) {
    if (this.anyOf.length === 0) {
      return true;
    }

    return this.anyOf.some((role) => roles.includes(role));
  }
}
