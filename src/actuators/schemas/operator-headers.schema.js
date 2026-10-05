import Joi from "joi";
import {
  ACTOR_MAX,
  actorIdSchema,
  decodeActor,
} from "../../common/actor-header.js";

// Room for that name percent-encoded: up to four UTF-8 bytes of `%XX` each.
const ENCODED_CHARS_PER_CHARACTER = 12;
const ENCODED_MAX = "UTF-8''".length + ACTOR_MAX * ENCODED_CHARS_PER_CHARACTER;

const assertDecodedLength = (value, helpers) =>
  decodeActor(value).length > ACTOR_MAX
    ? helpers.error("actor.tooLong")
    : value;

const actorHeader = Joi.string()
  .trim()
  .max(ENCODED_MAX)
  .custom(assertDecodedLength)
  .messages({
    "actor.tooLong": `"x-actor" must be at most ${ACTOR_MAX} characters`,
  })
  .empty("")
  .description("operator display name, verbatim or RFC 8187-encoded");

// An audited read names its operator, so neither header is optional.
export const operatorHeaders = Joi.object({
  "x-actor": actorHeader.required(),
  "x-actor-id": actorIdSchema
    .required()
    .description("operator Entra object id"),
})
  .unknown(true)
  .label("OperatorHeaders");

export const caseSearchHeaders = operatorHeaders
  .keys({
    "x-search-repeat": Joi.string()
      .valid("1")
      .description("the caller re-ran a stored first page"),
  })
  .label("CaseSearchHeaders");
