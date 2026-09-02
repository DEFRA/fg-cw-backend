import { SERVICE_TOKEN } from "./service-token.js";
import { wreck } from "./wreck.js";

const get = (path, query, token) =>
  wreck.get(query ? `${path}?${new URLSearchParams(query)}` : path, {
    headers: { authorization: token },
  });

export const findInbox = (query, token = `Bearer ${SERVICE_TOKEN}`) =>
  get("/actuators/inbox", query, token);

export const findOutbox = (query, token = `Bearer ${SERVICE_TOKEN}`) =>
  get("/actuators/outbox", query, token);
