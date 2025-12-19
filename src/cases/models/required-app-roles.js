export class RequiredAppRoles {
  constructor(props) {
    this.allOf = props.allOf ?? [];
    this.anyOf = props.anyOf ?? [];
  }
}
