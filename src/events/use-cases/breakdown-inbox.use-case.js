import { breakdown } from "../repositories/inbox.repository.js";

// The counts filter, minus two things.
//
// `status` is not a parameter: the breakdown is only ever over DEAD_LETTER
// rows - a row still retrying is not "stuck".
//
// `error` is accepted and deliberately not applied. The breakdown IS the list
// of failures, so narrowing it to one answers its own question with a single
// group; a caller that has narrowed a page to one error still wants to see
// which failures it could narrow to. The composite page has always read it
// that way, and these two answer the same question, so they answer it alike.
export const breakdownInboxUseCase = async ({ q, from, to, audit }) => ({
  groups: await breakdown({ q, from, to, audit }),
});
