import Boom from "@hapi/boom";

export class AppRole {
  constructor(props) {
    this.startDate = props.startDate;
    this.endDate = props.endDate;

    if (this.startDate && this.endDate) {
      this.validateRole(props.name);
    }
  }

  validateRole(name) {
    if (this.endDate <= this.startDate) {
      throw Boom.badRequest(
        `endDate must be greater than startDate for role ${name}.`,
      );
    }
  }
}
