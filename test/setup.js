import { DockerComposeEnvironment, Wait } from "testcontainers";

let environment;

export const setup = async ({ globalConfig }) => {
  const { env } = globalConfig;

  environment = await new DockerComposeEnvironment(".", "compose.yml")
    .withEnvironment({
      CW_PORT: env.CW_PORT,
      MONGO_PORT: env.MONGO_PORT,
      AWS_PORT: env.AWS_PORT,
      REDIS_PORT: env.REDIS_PORT
    })
    .withWaitStrategy("redis", Wait.forListeningPorts())
    .withWaitStrategy("mongodb", Wait.forListeningPorts())
    .withWaitStrategy("localstack", Wait.forHealthCheck())
    .withWaitStrategy("fg-cw-backend", Wait.forListeningPorts())
    .withNoRecreate()
    .up();
};

export const teardown = async () => {
  if (environment) {
    await environment.down();
  }
};
