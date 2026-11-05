import { requireCaseReader } from "../common/require-case-reader.js";
import { setAuditActor } from "../common/set-audit-actor.js";
import { caseExistsRoute } from "./routes/case-exists.route.js";
import {
  editInboxEventPayloadRoute,
  editOutboxEventPayloadRoute,
} from "./routes/edit-event-payload.route.js";
import { changeClientTokenExpiryRoute } from "./routes/change-client-token-expiry.route.js";
import { deleteClientTokenRoute } from "./routes/delete-client-token.route.js";
import { getInboxEventRoute } from "./routes/get-inbox-event.route.js";
import { getOutboxEventRoute } from "./routes/get-outbox-event.route.js";
import { issueClientTokenRoute } from "./routes/issue-client-token.route.js";
import { listClientsRoute } from "./routes/list-clients.route.js";
import { listBucketsRoute } from "./routes/list-buckets.route.js";
import { purgeInboxEventRoute } from "./routes/purge-inbox-event.route.js";
import { purgeOutboxEventRoute } from "./routes/purge-outbox-event.route.js";
import { queryBucketRoute } from "./routes/query-bucket.route.js";
import { readTimelineRoute } from "./routes/read-timeline.route.js";
import { summariseBucketRoute } from "./routes/summarise-bucket.route.js";
import { redriveInboxEventRoute } from "./routes/redrive-inbox-event.route.js";
import { redriveOutboxEventRoute } from "./routes/redrive-outbox-event.route.js";
import { revokeClientTokenRoute } from "./routes/revoke-client-token.route.js";
import { rotateClientTokenRoute } from "./routes/rotate-client-token.route.js";
import { viewCaseDataRoute } from "./routes/view-case-data.route.js";
import { fetchWorkflowDefinitionRoute } from "./routes/fetch-workflow-definition.route.js";
import { viewWorkflowVersionRoute } from "./routes/view-workflow-version.route.js";
import { viewWorkflowVersionsRoute } from "./routes/view-workflow-versions.route.js";
import { workflowVersionExistsRoute } from "./routes/workflow-version-exists.route.js";

export const actuators = {
  name: "actuators",
  register(server) {
    // Every actuator answers fg-gas-backend alone. Added first, so another
    // client is refused before its `x-actor-id` can name anyone in an audit.
    server.ext("onPostAuth", requireCaseReader, { sandbox: "plugin" });

    // Every audit event an actuator request writes names the operator GAS
    // forwarded, so it is set once here for this plugin's routes alone.
    server.ext("onPostAuth", setAuditActor, { sandbox: "plugin" });

    // Nothing here can be confused for anything else: a member of
    // `/actuators/events` sits one segment deeper than its box, and `{id}` is
    // constrained to 24 hex characters (schemas/event-id.schema.js);
    // index.test.js asserts both. A client's token routes all sit below
    // `/actuators/clients/{clientId}/tokens`, so no name collides with them.
    server.route([
      listBucketsRoute,
      queryBucketRoute,
      readTimelineRoute,
      summariseBucketRoute,
      getInboxEventRoute,
      getOutboxEventRoute,
      redriveInboxEventRoute,
      redriveOutboxEventRoute,
      purgeInboxEventRoute,
      purgeOutboxEventRoute,
      editInboxEventPayloadRoute,
      editOutboxEventPayloadRoute,
      viewCaseDataRoute,
      caseExistsRoute,
      viewWorkflowVersionsRoute,
      viewWorkflowVersionRoute,
      fetchWorkflowDefinitionRoute,
      workflowVersionExistsRoute,
      listClientsRoute,
      issueClientTokenRoute,
      revokeClientTokenRoute,
      changeClientTokenExpiryRoute,
      rotateClientTokenRoute,
      deleteClientTokenRoute,
    ]);
  },
};
