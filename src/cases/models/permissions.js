export class Permissions {
  constructor(props) {
    this.allOf = props.allOf || [];
    this.anyOf = props.anyOf || [];
  }

  isAuthorised(roles) {
    if (
      this.allOf.length &&
      !this.allOf.every((role) => roles.includes(role))
    ) {
      return false;
    }

    if (this.anyOf.length && !this.anyOf.some((role) => roles.includes(role))) {
      return false;
    }

    return true;
  }
}
