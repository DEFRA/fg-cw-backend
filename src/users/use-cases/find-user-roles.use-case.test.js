import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRole } from "../models/app-role.js";
import { User } from "../models/user.js";
import { findByIdpId } from "../repositories/user.repository.js";
import { findUserRolesUseCase } from "./find-user-roles.use-case.js";

vi.mock("../repositories/user.repository.js");

const entraId = "6a232710-1c66-4f8b-967d-41d41ae38478";

const userWithRoles = (appRoles) =>
  User.createMock({
    idpId: entraId,
    appRoles: Object.fromEntries(
      Object.entries(appRoles).map(([name, dates]) => [
        name,
        new AppRole({ name, ...dates }),
      ]),
    ),
  });

describe("findUserRolesUseCase", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns active roles with their date range", async () => {
    findByIdpId.mockResolvedValue(
      userWithRoles({
        ROLE_WMP_CLAIMS: { startDate: "2025-07-01", endDate: "2100-01-01" },
      }),
    );

    const result = await findUserRolesUseCase({ entraId });

    expect(findByIdpId).toHaveBeenCalledWith(entraId);
    expect(result).toEqual({
      appRoles: [
        { roleName: "ROLE_WMP_CLAIMS", from: "2025-07-01", to: "2100-01-01" },
      ],
    });
  });

  it("returns null dates for an open-ended role", async () => {
    findByIdpId.mockResolvedValue(userWithRoles({ ROLE_WMP_CLAIMS: {} }));

    const result = await findUserRolesUseCase({ entraId });

    expect(result).toEqual({
      appRoles: [{ roleName: "ROLE_WMP_CLAIMS", from: null, to: null }],
    });
  });

  it("serialises open-ended dates as null rather than omitting them", async () => {
    findByIdpId.mockResolvedValue(userWithRoles({ ROLE_WMP_CLAIMS: {} }));

    const { appRoles } = await findUserRolesUseCase({ entraId });

    expect(JSON.parse(JSON.stringify(appRoles[0]))).toEqual({
      roleName: "ROLE_WMP_CLAIMS",
      from: null,
      to: null,
    });
  });

  it("excludes roles that have already ended", async () => {
    findByIdpId.mockResolvedValue(
      userWithRoles({
        ROLE_WMP_CLAIMS: { startDate: "2020-01-01", endDate: "2020-12-31" },
      }),
    );

    expect(await findUserRolesUseCase({ entraId })).toEqual({ appRoles: [] });
  });

  it("excludes roles that have not started", async () => {
    findByIdpId.mockResolvedValue(
      userWithRoles({
        ROLE_WMP_CLAIMS: { startDate: "2999-01-01", endDate: "2999-12-31" },
      }),
    );

    expect(await findUserRolesUseCase({ entraId })).toEqual({ appRoles: [] });
  });

  it("returns only the active roles when a user holds a mix", async () => {
    findByIdpId.mockResolvedValue(
      userWithRoles({
        ROLE_ACTIVE: { startDate: "2025-07-01", endDate: "2100-01-01" },
        ROLE_EXPIRED: { startDate: "2020-01-01", endDate: "2020-12-31" },
      }),
    );

    expect(await findUserRolesUseCase({ entraId })).toEqual({
      appRoles: [
        { roleName: "ROLE_ACTIVE", from: "2025-07-01", to: "2100-01-01" },
      ],
    });
  });

  it("returns an empty list for a user with no roles", async () => {
    findByIdpId.mockResolvedValue(userWithRoles({}));

    expect(await findUserRolesUseCase({ entraId })).toEqual({ appRoles: [] });
  });

  // Must match the "no roles" response exactly, so the endpoint never confirms
  // whether an account exists.
  it("returns an empty list for an unknown user", async () => {
    findByIdpId.mockResolvedValue(null);

    expect(await findUserRolesUseCase({ entraId })).toEqual({ appRoles: [] });
  });

  it("does not throw for a user document with no appRoles", async () => {
    findByIdpId.mockResolvedValue(new User({ idpId: entraId, appRoles: {} }));

    expect(await findUserRolesUseCase({ entraId })).toEqual({ appRoles: [] });
  });
});
