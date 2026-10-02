import { config } from "./config.js";

// Every actuator read is bounded, so one that outlives its caller's HTTP
// timeout stops on the server rather than running on.
export const actuatorReadMaxTimeMs = () =>
  config.get("mongo.actuatorReadMaxTimeMs");
