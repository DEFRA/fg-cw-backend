import Joi from "joi";
import { S3FetchError } from "../../common/s3-client.js";
import { validateProps } from "../../common/validation.js";

const MESSAGE_MAX = 500;

// classifyS3Error cannot tell a timeout from any other service error, so every
// failure a retry might fix is a timeout.
const S3_REASONS = {
  NoSuchKey: "missing",
  AccessDenied: "forbidden",
  PARSE_ERROR: "unparseable",
};

// What became of the workflow file when an operator fetched a version's
// definitions.
export class WorkflowDefinitionFetch {
  constructor(props) {
    const { file, outcome, reason, message } = validateProps(
      props,
      WorkflowDefinitionFetch.validationSchema,
      "WorkflowDefinitionFetch",
    );

    this.file = file;
    this.outcome = outcome;

    if (reason) {
      this.reason = reason;
    }

    if (message) {
      this.message = message;
    }
  }

  static stored() {
    return new WorkflowDefinitionFetch({ file: "workflow", outcome: "stored" });
  }

  static failed({ reason, message }) {
    return new WorkflowDefinitionFetch({
      file: "workflow",
      outcome: "failed",
      reason,
      message,
    });
  }

  static fromError(error) {
    if (error instanceof S3FetchError) {
      return WorkflowDefinitionFetch.failed({
        reason: S3_REASONS[error.code] ?? "timeout",
      });
    }

    return WorkflowDefinitionFetch.failed({
      reason: "invalid",
      message: error.message.slice(0, MESSAGE_MAX),
    });
  }
}

WorkflowDefinitionFetch.validationSchema = Joi.object({
  file: Joi.string().valid("workflow").required(),
  outcome: Joi.string().valid("stored", "failed").required(),
  reason: Joi.when("outcome", {
    is: "failed",
    then: Joi.string()
      .valid("missing", "forbidden", "timeout", "unparseable", "invalid")
      .required(),
    otherwise: Joi.forbidden(),
  }),
  message: Joi.when("reason", {
    is: "invalid",
    then: Joi.string().max(MESSAGE_MAX).required(),
    otherwise: Joi.forbidden(),
  }),
});
