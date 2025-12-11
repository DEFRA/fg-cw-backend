import * as path from "node:path";
import { styleText } from "node:util";
import { DockerComposeEnvironment, Wait } from "testcontainers";
import { ensureQueues } from "./helpers/sqs.js";

let environment;

export const setup = async ({ globalConfig }) => {
  const { env } = globalConfig;

  const composeFilePath = path.resolve(import.meta.dirname, "..");

  environment = await new DockerComposeEnvironment(
    composeFilePath,
    "compose.yml",
  )
    .withBuild()
    .withEnvironment({
      CW_PORT: env.CW_PORT,
      MONGO_PORT: env.MONGO_PORT,
      LOCALSTACK_PORT: env.LOCALSTACK_PORT,
      ENTRA_PORT: env.ENTRA_PORT,
    })
    .withWaitStrategy("fg-cw-backend", Wait.forHttp("/health"))
    .withNoRecreate()
    .up();

  await ensureQueues([
    env.CW__SQS__CREATE_NEW_CASE_URL,
    env.CW__SQS__UPDATE_STATUS_URL,
  ]);

  if (env.PRINT_LOGS) {
    const backendContainer = environment.getContainer("fg-cw-backend-1");
    const logStream = await backendContainer.logs();

    logStream.on("data", (line) =>
      process.stdout.write(styleText("gray", line)),
    );
  }
};

export const teardown = async () => {
  await environment?.down();
};
