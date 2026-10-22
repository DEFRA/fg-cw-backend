import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigVersion } from "../../cases/models/config-version.js";
import {
  findAllForCode,
  findCurrent,
} from "../../cases/repositories/config-version.repository.js";
import { findStoredVersions } from "../../cases/repositories/workflow.repository.js";
import { FetchStatus } from "../../common/fetch-status.js";
import { viewWorkflowVersionsUseCase } from "./view-workflow-versions.use-case.js";

vi.mock("../../cases/repositories/config-version.repository.js");
vi.mock("../../cases/repositories/workflow.repository.js");

const aRow = (version, overrides = {}) =>
  ConfigVersion.createMock({
    grantCode: "woodland",
    version,
    receivedAt: "2026-10-15T10:04:00.000Z",
    ...overrides,
  });

beforeEach(() => {
  findAllForCode.mockResolvedValue([
    aRow("2.0.0", { status: "draft" }),
    aRow("1.2.0"),
  ]);
  findCurrent.mockResolvedValue(aRow("1.2.0"));
  findStoredVersions.mockResolvedValue(new Set(["1.2.0"]));
});

describe("viewWorkflowVersionsUseCase", () => {
  it("answers every version newest first, and the current one", async () => {
    expect(await viewWorkflowVersionsUseCase({ code: "woodland" })).toEqual({
      code: "woodland",
      current: "1.2.0",
      versions: [
        {
          version: "2.0.0",
          status: "draft",
          receivedAt: "2026-10-15T10:04:00.000Z",
          fetchStatus: "pending",
          stored: false,
        },
        {
          version: "1.2.0",
          status: "active",
          receivedAt: "2026-10-15T10:04:00.000Z",
          fetchStatus: "pending",
          stored: true,
        },
      ],
    });
    expect(findAllForCode).toHaveBeenCalledWith("woodland");
    expect(findCurrent).toHaveBeenCalledWith("woodland");
    expect(findStoredVersions).toHaveBeenCalledWith("woodland", [
      "2.0.0",
      "1.2.0",
    ]);
  });

  it("answers each version's own fetch status, apart from whether it is stored", async () => {
    findAllForCode.mockResolvedValue([
      aRow("1.2.0", { fetchStatus: FetchStatus.Fetched }),
      aRow("1.1.0", { fetchStatus: FetchStatus.PermanentError }),
    ]);
    findStoredVersions.mockResolvedValue(new Set(["1.2.0", "1.1.0"]));

    const { versions } = await viewWorkflowVersionsUseCase({
      code: "woodland",
    });

    expect(
      versions.map(({ fetchStatus, stored }) => [fetchStatus, stored]),
    ).toEqual([
      ["fetched", true],
      ["permanent_error", true],
    ]);
  });

  it("answers a null current version when none is active", async () => {
    findCurrent.mockResolvedValue(null);

    expect(
      (await viewWorkflowVersionsUseCase({ code: "woodland" })).current,
    ).toBeNull();
  });

  it("gives a Date or missing receipt time as ISO text or null", async () => {
    findAllForCode.mockResolvedValue([
      aRow("1.0.0", { receivedAt: new Date("2026-10-01T00:00:00.000Z") }),
      { ...aRow("0.0.0"), receivedAt: undefined },
    ]);

    const { versions } = await viewWorkflowVersionsUseCase({
      code: "woodland",
    });

    expect(versions.map(({ receivedAt }) => receivedAt)).toEqual([
      "2026-10-01T00:00:00.000Z",
      null,
    ]);
  });

  it("answers 404 with reason WORKFLOW_NOT_FOUND for a code with no versions", async () => {
    findAllForCode.mockResolvedValue([]);
    findCurrent.mockResolvedValue(null);

    await expect(
      viewWorkflowVersionsUseCase({ code: "nope" }),
    ).rejects.toMatchObject({
      output: {
        statusCode: 404,
        payload: { reason: "WORKFLOW_NOT_FOUND" },
      },
    });
    expect(findStoredVersions).not.toHaveBeenCalled();
  });
});
