import Boom from "@hapi/boom";
import Joi from "joi";
import { validateProps } from "../../common/validation.js";

export class WorkflowExternalAction {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.description = props.description;
    this.display = props.display;
    this.endpoint = props.endpoint;
    this.target = props.target;
  }

  static fromDefinition(definition, endpoints) {
    const entityName = `WorkflowExternalAction "${definition?.code}"`;
    validateProps(
      definition,
      WorkflowExternalAction.definitionSchema,
      entityName,
    );

    const endpointCode = definition.endpoint.code;
    if (!endpoints.some((endpoint) => endpoint.code === endpointCode)) {
      throw Boom.badRequest(
        `Invalid ${entityName}: endpoint "${endpointCode}" is not one of the workflow's endpoints`,
      );
    }

    return new WorkflowExternalAction(definition);
  }
}

// The runtime throws on a kind it does not know, so one is refused here rather
// than stripped.
const EndpointParams = Joi.object()
  .pattern(
    Joi.valid("PATH", "BODY", "HEADERS"),
    Joi.object().pattern(Joi.string(), Joi.string()),
  )
  .prefs({ stripUnknown: false });

const Target = Joi.object({
  dataType: Joi.string().valid("ARRAY", "OBJECT").required(),
  key: Joi.string().when("dataType", { is: "OBJECT", then: Joi.required() }),
}).unknown();

WorkflowExternalAction.definitionSchema = Joi.object({
  code: Joi.string().required(),
  endpoint: Joi.object({
    code: Joi.string().required(),
    endpointParams: EndpointParams.optional(),
  }).required(),
  target: Target.allow(null).optional(),
}).unknown();
