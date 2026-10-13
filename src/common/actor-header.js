import Joi from "joi";

// The cap on an operator's name, as `by` on a mutation and decoded `x-actor`.
export const ACTOR_MAX = 128;

export const actorIdSchema = Joi.string().guid();

// GAS forwards `x-actor` as GPA sent it: verbatim, or RFC 8187-encoded when the
// name has characters an HTTP header cannot carry.
const ENCODED_PREFIX = "UTF-8''";

// A value that claims to be encoded and is not decodable is kept as it stands:
// a name that reads oddly in an audit record is better than none.
export const decodeActor = (actor) => {
  if (!actor?.startsWith(ENCODED_PREFIX)) {
    return actor;
  }

  try {
    return decodeURIComponent(actor.slice(ENCODED_PREFIX.length));
  } catch {
    return actor;
  }
};

// The operator a read is made for, as GAS forwarded them.
export const operatorOf = (request) => ({
  id: request.headers["x-actor-id"],
  name: decodeActor(request.headers["x-actor"]),
});
