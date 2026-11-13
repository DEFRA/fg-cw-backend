export const createRoleFilter = (roles) => {
  // Checks if all roles are in userRoles. Allows the workflow roles to be empty.
  const allOf = {
    $or: [
      { $eq: [{ $ifNull: ["$requiredRoles.allOf", []] }, []] }, // allow empty roles on workflow
      { $setIsSubset: ["$requiredRoles.allOf", roles] },
    ],
  };

  // Checks any (more than one) are in userRoles. Allows the workflow roles to be empty though.
  const anyOf = {
    $or: [
      {
        $eq: [{ $ifNull: ["$requiredRoles.anyOf", []] }, []], // allow empty roles on workflow
      },
      {
        $gt: [
          {
            $size: { $setIntersection: ["$requiredRoles.anyOf", roles] },
          },
          0,
        ],
      },
    ],
  };

  return {
    $expr: {
      $and: [allOf, anyOf],
    },
  };
};
