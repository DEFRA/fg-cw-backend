import Joi from "joi";
import { ACTOR_MAX } from "../../common/actor-header.js";

// The operator GAS forwarded from `x-actor`; this service never invents one.
const actor = () =>
  Joi.string()
    .trim()
    .max(ACTOR_MAX)
    .empty("")
    .description("operator the mutation is made on behalf of");

export const actorQuery = Joi.object({ by: actor() }).label("ActorQuery");

// For a mutation audited under the operator's name, which cannot then be
// anonymous. `empty("")` makes a blank one absent, and absent fails `required`.
export const requiredActorQuery = Joi.object({
  by: actor().required(),
}).label("RequiredActorQuery");
