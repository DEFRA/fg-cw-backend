import { actuatorReadMaxTimeMs } from "./actuator-read.js";

// The longest a bucket or Explore read runs on the server.
export const readTimeoutMs = () => actuatorReadMaxTimeMs();
