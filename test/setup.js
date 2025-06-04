import { DockerComposeEnvironment, Wait } from "testcontainers";

let environment;

export const setup = async ({ globalConfig }) => {
  const { env } = globalConfig;

  environment = await new DockerComposeEnvironment(".", "compose.yml")
    .withEnvironment({
      CW_PORT: env.CW_PORT,
      MONGO_PORT: env.MONGO_PORT,
      LOCALSTACK_ENABLED: env.LOCALSTACK_ENABLED,
      AWS_PORT: env.AWS_PORT,
      SQS_ENDPOINT: env.SQS_ENDPOINT,
      SNS_ENDPOINT: env.SNS_ENDPOINT,
      CREATE_NEW_CASE_SQS_URL: env.CREATE_NEW_CASE_SQS_URL,
    })
    .withWaitStrategy("fg-cw-backend", Wait.forListeningPorts())
    .withNoRecreate()
    .up();
};

export const teardown = async () => {
  await environment?.down();
};
