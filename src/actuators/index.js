import { breakdownInboxRoute } from "./routes/breakdown-inbox.route.js";
import { breakdownOutboxRoute } from "./routes/breakdown-outbox.route.js";
import { countInboxRoute } from "./routes/count-inbox.route.js";
import { countOutboxRoute } from "./routes/count-outbox.route.js";
import { findInboxRoute } from "./routes/find-inbox.route.js";
import { findOutboxRoute } from "./routes/find-outbox.route.js";
import { getInboxEventRoute } from "./routes/get-inbox-event.route.js";
import { getOutboxEventRoute } from "./routes/get-outbox-event.route.js";
import { parkInboxEventRoute } from "./routes/park-inbox-event.route.js";
import { parkOutboxEventRoute } from "./routes/park-outbox-event.route.js";
import { redriveInboxEventRoute } from "./routes/redrive-inbox-event.route.js";
import { redriveOutboxEventRoute } from "./routes/redrive-outbox-event.route.js";
import { unparkInboxEventRoute } from "./routes/unpark-inbox-event.route.js";
import { unparkOutboxEventRoute } from "./routes/unpark-outbox-event.route.js";

export const actuators = {
  name: "actuators",
  register(server) {
    // The literal-segment routes (`/counts`, `/breakdown`) are registered
    // before the `/{id}` detail routes. hapi's router prefers a literal
    // segment over a parameter, so the order is belt-and-braces rather than
    // load-bearing - see the ROUTE ORDER notes in count-inbox.route.js and
    // breakdown-inbox.route.js, and the conflict tests in index.test.js.
    server.route([
      findInboxRoute,
      findOutboxRoute,
      countInboxRoute,
      countOutboxRoute,
      breakdownInboxRoute,
      breakdownOutboxRoute,
      getInboxEventRoute,
      getOutboxEventRoute,
      redriveInboxEventRoute,
      redriveOutboxEventRoute,
      parkInboxEventRoute,
      parkOutboxEventRoute,
      unparkInboxEventRoute,
      unparkOutboxEventRoute,
    ]);
  },
};
