import Joi from "joi";

const OBJECT_ID = /^[0-9a-f]{24}$/i;

// The Mongo `_id` of one inbox/outbox row, exactly as the list returns it.
// Validated as 24 hex characters so a malformed id is a 400 before any query
// runs, rather than an ObjectId constructor throwing a 500.
export const eventIdParams = Joi.object({
  id: Joi.string()
    .pattern(OBJECT_ID)
    .required()
    .example("665f1c2e9a1b2c3d4e5f6a7b")
    .description("24-character hex Mongo _id"),
});
