import { describe, expect, it, vi } from "vitest";
import { actuatorReadMaxTimeMs } from "./actuator-read.js";
import { config } from "./config.js";

describe("actuatorReadMaxTimeMs", () => {
  it("is the configured actuator read limit", () => {
    vi.spyOn(config, "get").mockReturnValue(1234);

    expect(actuatorReadMaxTimeMs()).toBe(1234);
    expect(config.get).toHaveBeenCalledWith("mongo.actuatorReadMaxTimeMs");
  });
});
