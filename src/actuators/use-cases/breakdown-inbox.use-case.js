import { breakdown } from "../../cases/repositories/inbox.repository.js";

// How the inbox's dead letters group by (failure message, event type). The
// filter is exactly the counts filter; `status` is not a parameter because the
// breakdown is always and only over DEAD_LETTER rows - a PARKED row was taken
// out of the loop on purpose and is not "stuck".
export const breakdownInboxUseCase = async ({ q, error, from, to }) => ({
  groups: await breakdown({ q, error, from, to }),
});
