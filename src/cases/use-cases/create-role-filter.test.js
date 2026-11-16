import { describe, expect, it } from "vitest";
import { createRoleFilter } from "./create-role-filter.js";

describe("createRoleFilter", () => {
  const userRoles = ["ROLE_1", "ROLE_3", "ROLE_APP_1"];

  it("creates a filter for user roles", () => {
    const expectedFilters = {
      $expr: {
        $and: [
          {
            $or: [
              {
                $eq: [{ $ifNull: ["$requiredRoles.allOf", []] }, []],
              },
              {
                $setIsSubset: ["$requiredRoles.allOf", userRoles],
              },
            ],
          },
          {
            $or: [
              {
                $eq: [{ $ifNull: ["$requiredRoles.anyOf", []] }, []],
              },
              {
                $gt: [
                  {
                    $size: {
                      $setIntersection: ["$requiredRoles.anyOf", userRoles],
                    },
                  },
                  0,
                ],
              },
            ],
          },
        ],
      },
    };
    expect(createRoleFilter(userRoles)).toEqual(expectedFilters);
  });
});
