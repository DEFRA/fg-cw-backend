import Boom from "@hapi/boom";

export class Position {
  static #separator = ":";
  static #format = /^(?=.*[A-Z0-9_])[A-Z0-9_]*:[A-Z0-9_]*:[A-Z0-9_]*$/;

  constructor(props) {
    this.phaseCode = props.phaseCode;
    this.stageCode = props.stageCode;
    this.statusCode = props.statusCode;
  }

  static from(position) {
    if (!Position.#format.test(position)) {
      throw Boom.badData(
        `Position ${position} does not match format ${Position.#format}`,
      );
    }

    const [phaseCode, stageCode, statusCode] = position.split(
      Position.#separator,
    );

    return new Position({
      phaseCode,
      stageCode,
      statusCode,
    });
  }

  toString() {
    return [this.phaseCode, this.stageCode, this.statusCode].join(
      Position.#separator,
    );
  }

  equals(position) {
    return (
      this.phaseCode === position.phaseCode &&
      this.stageCode === position.stageCode &&
      this.statusCode === position.statusCode
    );
  }

  isSamePhase(position) {
    return this.phaseCode === position.phaseCode;
  }

  isSameStage(position) {
    return this.isSamePhase(position) && this.stageCode === position.stageCode;
  }

  toJSON() {
    return this.toString();
  }
}
