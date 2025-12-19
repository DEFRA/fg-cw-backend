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

  isActive() {
    const currentDate = new Date();
    const startDate = new Date(this.startDate + "T00:00:00.000Z");
    const endDate = new Date(this.endDate + "T23:59:59.999Z");

    return currentDate >= startDate && currentDate <= endDate;
  }
}
