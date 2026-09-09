import { breakdown } from "../../cases/repositories/outbox.repository.js";

// `error` is accepted and deliberately not applied - see the inbox twin.
export const breakdownOutboxUseCase = async ({ q, from, to, audit }) => ({
  groups: await breakdown({ q, from, to, audit }),
});
