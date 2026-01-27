export class RequiredAppRoles {
  constructor(props) {
    this.allOf = props.allOf ?? [];
    this.anyOf = props.anyOf ?? [];
  }

  static None = new RequiredAppRoles({
    allOf: [],
    anyOf: [],
  });
}
