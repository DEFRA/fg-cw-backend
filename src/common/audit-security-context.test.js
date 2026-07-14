import { describe, expect, it } from "vitest";
import {
  buildActorSummary,
  buildSecurityContext,
  buildUserSummary,
} from "./audit-security-context.js";

const actor = {
  id: "actor-1",
  idpId: "idp-actor-1",
  name: "Admin Alice",
  email: "alice@defra.gov.uk",
  idpRoles: ["FCP.Casework.Admin"],
  appRoles: { ROLE_1: { startDate: "2025-01-01", endDate: "2100-01-01" } },
};

const targetUser = {
  id: "target-1",
  idpId: "idp-target-1",
  name: "Bob Bill",
  email: "bob.bill@defra.gov.uk",
  idpRoles: ["FCP.Casework.ReadWrite"],
  appRoles: {
    ROLE_1: { startDate: "2025-01-01", endDate: "2100-01-01" },
    ROLE_2: { startDate: "2025-02-01", endDate: null },
  },
};

describe("buildActorSummary", () => {
  it("returns id, idpId, name, email and idpRoles", () => {
    expect(buildActorSummary(actor)).toEqual({
      id: "actor-1",
      idpId: "idp-actor-1",
      name: "Admin Alice",
      email: "alice@defra.gov.uk",
      idpRoles: ["FCP.Casework.Admin"],
    });
  });

  it("does not include appRoles", () => {
    expect(buildActorSummary(actor)).not.toHaveProperty("appRoles");
  });
});

describe("buildUserSummary", () => {
  it("includes actor fields plus a summary of appRoles", () => {
    expect(buildUserSummary(targetUser)).toEqual({
      id: "target-1",
      idpId: "idp-target-1",
      name: "Bob Bill",
      email: "bob.bill@defra.gov.uk",
      idpRoles: ["FCP.Casework.ReadWrite"],
      appRoles: {
        ROLE_1: { startDate: "2025-01-01", endDate: "2100-01-01" },
        ROLE_2: { startDate: "2025-02-01", endDate: null },
      },
    });
  });

  it("defaults appRoles to an empty object when the user has none", () => {
    const result = buildUserSummary({ ...targetUser, appRoles: undefined });
    expect(result.appRoles).toEqual({});
  });
});

describe("buildSecurityContext", () => {
  it("returns only an actor summary when no target user is given", () => {
    expect(buildSecurityContext(actor)).toEqual({
      actor: buildActorSummary(actor),
    });
  });

  it("includes a target user summary when a target user is given", () => {
    expect(buildSecurityContext(actor, targetUser)).toEqual({
      actor: buildActorSummary(actor),
      targetUser: buildUserSummary(targetUser),
    });
  });

  it("omits targetUser when the target user is falsy", () => {
    expect(buildSecurityContext(actor, null)).not.toHaveProperty("targetUser");
  });
});
