import { DockerComposeEnvironment, Wait } from "testcontainers";

let environment;

export const setup = async ({ globalConfig }) => {
  const { env } = globalConfig;

  environment = await new DockerComposeEnvironment(".", "compose.yml")
    .withEnvironment({
      CW_PORT: env.CW_PORT,
      MONGO_PORT: env.MONGO_PORT,
      AWS_PORT: env.AWS_PORT,
      SQS_ENDPOINT: env.SQS_ENDPOINT,
      SNS_ENDPOINT: env.SNS_ENDPOINT,
      CREATE_NEW_CASE_SQS_URL: env.CREATE_NEW_CASE_SQS_URL,
      REDIS_PORT: env.REDIS_PORT
    })
    .withWaitStrategy("redis", Wait.forListeningPorts())
    .withWaitStrategy(
      "mongodb",
      Wait.forAll([
        Wait.forLogMessage("Finished running DB Migrations"),
        Wait.forListeningPorts()
      ])
    )
    .withWaitStrategy(
      "localstack",
      Wait.forAll([Wait.forLogMessage("Ready."), Wait.forListeningPorts()])
    )
    .withWaitStrategy("fg-cw-backend", Wait.forListeningPorts())
    .withNoRecreate()
    .up();
  // Small delay to allow containers to finish starting up
  await new Promise((resolve) => setTimeout(resolve, 3000));
};

export const teardown = async () => {
  if (environment) {
    await environment.down();
  }
};
