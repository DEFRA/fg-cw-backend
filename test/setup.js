import * as path from "node:path";
import { DockerComposeEnvironment, Wait } from "testcontainers";

let environment;

export const setup = async ({ globalConfig }) => {
  const { env } = globalConfig;

  const composeFilePath = path.resolve(import.meta.dirname, "..");

  environment = await new DockerComposeEnvironment(
    composeFilePath,
    "compose.yml",
  )
    .withEnvironment({
      CW_PORT: env.CW_PORT,
      MONGO_PORT: env.MONGO_PORT,
      LOCALSTACK_PORT: env.LOCALSTACK_PORT,
      ENTRA_PORT: env.ENTRA_PORT,
      // Pass OIDC configuration to container
      OIDC_JWKS_URI: env.OIDC_JWKS_URI,
      OIDC_VERIFY_ISS: env.OIDC_VERIFY_ISS,
      OIDC_VERIFY_AUD: env.OIDC_VERIFY_AUD,
    })
    .withWaitStrategy("fg-cw-backend", Wait.forHttp("/health"))
    .withNoRecreate()
    .up();
};

export const teardown = async () => {
  await environment?.down();
};
