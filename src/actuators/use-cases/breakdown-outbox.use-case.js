import { breakdown } from "../../cases/repositories/outbox.repository.js";

// How the outbox's dead letters group by (failure message, event type). The
// filter is exactly the counts filter; `status` is not a parameter because the
// breakdown is always and only over DEAD_LETTER rows - a row that is still
// retrying is not "stuck".
export const breakdownOutboxUseCase = async ({ q, error, from, to }) => ({
  groups: await breakdown({ q, error, from, to }),
});
