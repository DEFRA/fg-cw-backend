import * as path from "node:path";
import { styleText } from "node:util";
import { DockerComposeEnvironment, Wait } from "testcontainers";

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
      OIDC_JWKS_URI: env.OIDC_JWKS_URI,
      OIDC_VERIFY_ISS: env.OIDC_VERIFY_ISS,
      OIDC_VERIFY_AUD: env.OIDC_VERIFY_AUD,
      ENVIRONMENT: env.ENVIRONMENT,
      OUTBOX_POLL_MS: 250,
    })
    .withWaitStrategy("fg-cw-backend", Wait.forHttp("/health"))
    .withNoRecreate()
    .up();

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
