import { actorIdSchema } from "./actor-header.js";
import { getRequestContext } from "./request-context.js";

const oidSchema = actorIdSchema.required();

// The operator's Entra object id, once per request, so every audit event the
// request writes names them in `user`. A value that is not a GUID is ignored;
// routes that need an operator require the header in their own schema.
export const setAuditActor = (request, h) => {
  const { error, value } = oidSchema.validate(request.headers["x-actor-id"]);
  const context = getRequestContext();

  if (!error && context) {
    context.user = value;
  }

  return h.continue;
};
