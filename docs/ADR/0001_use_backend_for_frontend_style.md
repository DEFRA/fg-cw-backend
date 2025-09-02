# ADR-001: Use Backend for Frontend (BFF) Pattern

## Date

2025-08-07 - When the decision was made

## Status

Accepted

## Context

The decision to use a frontend (fg-cw-frontend) and backend (fg-cw-backend) architecture was imposed by the internal deployment platform to ensure physical separation between the public-facing website and the backend application with database connections. Given this constraint, we needed to determine the most effective communication pattern between these two systems.

We identified two potential approaches:

- The frontend could aggregate data by calling multiple granular backend REST APIs
- The backend could provide specialized endpoints that aggregate data specifically for frontend needs

Key considerations included:

- Complexity distribution between frontend and backend
- Maintainability and development efficiency
- Data consistency across views
- Simplicity of frontend code

Other considerations:

- Performance and network overhead
- User experience and page load times

## Decision

We will implement the Backend for Frontend (BFF) pattern where the backend provides specialized endpoints that aggregate data specifically for frontend needs. This means:

- Backend endpoints will be designed to serve specific frontend views
- Data aggregation will occur in the backend, not the frontend
- The backend will return consolidated responses containing all data needed for a particular view
- Frontend code will be simplified with less data manipulation logic

This is the default approach, not a hard and fast rule. Other approaches could be used if it made sense for a specific use case, but the BFF pattern will be the primary method of communication between the frontend and backend.

## Consequences

Positive:

- Reduced network overhead with fewer API calls
- Improved performance and faster page loads
- Simplified frontend code with less data manipulation logic
- Better user experience due to reduced loading times
- Centralized business logic for data aggregation
- Easier maintenance of data consistency

Negative:

- Reduced API reusability as endpoints are tailored to specific frontend views
- Increased backend complexity as it takes on more responsibility for data aggregation
- Tighter coupling between frontend views and backend endpoints
- Changes to frontend views often require corresponding backend changes
- Development requires more coordination between frontend and backend teams

## Alternatives Considered

1. Multiple REST APIs with Frontend Aggregation
   - The backend would expose granular REST APIs
   - The frontend would make multiple API calls and aggregate data
   - Would provide more reusable APIs and clearer separation of concerns
   - Not chosen due to performance concerns, network overhead, and complexity in frontend code
   - Example: For a case timeline view, the frontend would need to make separate calls for case data, timeline entries, user details, and workflow definitions

## References

- Current implementation in `src/cases/use-cases/find-case-by-id.use-case.js` showing backend aggregation
- `src/cases/routes/find-case-by-id.route.js` demonstrating the BFF endpoint pattern
- [Research](../research/frontent-for-backend-or-rest.md)
- Industry articles on BFF pattern: [Pattern: Backends For Frontends](https://samnewman.io/patterns/architectural/bff/)
