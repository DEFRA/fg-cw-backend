export class RequiredRolesDocument {
  constructor(props) {
    this.allOf = props.allOf;
    this.anyOf = props.anyOf;
  }
}
