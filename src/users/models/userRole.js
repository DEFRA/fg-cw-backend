import Boom from "@hapi/boom";

export class UserRole {
  constructor(props) {
    this.roleName = props.roleName;
    this.startDate = props.startDate;
    this.endDate = props.endDate;

    if (this.startDate && this.endDate) {
      this.validateRole();
    }
  }

  validateRole() {
    const startDateObj = new Date(this.startDate);
    const endDateObj = new Date(this.endDate);

    if (endDateObj <= startDateObj) {
      throw Boom.badRequest(
        `endDate must be greater than startDate for role ${this.roleName}. startDate: ${this.startDate}, endDate: ${this.endDate}`,
      );
    }
  }
}
