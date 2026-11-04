# Domain language

## Cases

**Workflow Definition**
: The published `cw.json` for one config version of a grant. A config version is only recorded once its Workflow Definition builds a usable Workflow.

**Position**
: Where a case sits in its workflow, written `PHASE:STAGE:STATUS`. Every position a Workflow Definition refers to must be one of its own.

**Current Version**
: The config version a workflow's admin read opens when no version is named: the newest Active one across all majors, even when its workflow file is Failed. A case resolves its workflow differently: to the newest Active version in the requested major whose workflow file is not Failed.

## API clients

**API Client**
: A named caller of this service's public API, such as `fg-gas-backend`. It has no record of its own: it is the access tokens that share its name. Avoid: service account, API key.

**Access Token**
: One credential of one API client, stored only as a SHA-256 hash. Its status is derived, never stored: Revoked once revoked, otherwise Expired once a stored expiry has passed, otherwise Active. An API client may hold several Active tokens, so a rotation can overlap.

**Platform Client**
: The API client the grants admin reaches this service through, `fg-gas-backend`. It is managed like any other, except that a request can never revoke the token it is made with.
