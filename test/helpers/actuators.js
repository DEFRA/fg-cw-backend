import { SERVICE_TOKEN } from "./service-token.js";
import { wreck } from "./wreck.js";

export const findBoxes = (token = `Bearer ${SERVICE_TOKEN}`) =>
  wreck.get("/actuators/boxes", { headers: { authorization: token } });
