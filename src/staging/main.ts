import process from "node:process";
import { createLocalBoundary, type InfrastructureLogger } from "./local-boundary.js";
import {
  RUNTIME_CONFIG_PATH,
  loadLocalRuntimeConfig,
} from "./runtime-config.js";
import { createLocalRuntimeComposition } from "./runtime-composition.js";

const logger: InfrastructureLogger = {
  log: (event, fields = {}) => {
    console.log(JSON.stringify({ event, ...fields }));
  },
};

async function main(): Promise<void> {
  const configuredPath = process.env.APPTS_RUNTIME_CONFIG;
  if (!configuredPath) throw new Error("APPTS_RUNTIME_CONFIG_REQUIRED");
  if (configuredPath !== RUNTIME_CONFIG_PATH) throw new Error("APPTS_RUNTIME_CONFIG_PATH_NOT_ADMITTED");

  const { config, fixture } = await loadLocalRuntimeConfig(configuredPath);
  const runtime = await createLocalRuntimeComposition(config, fixture);
  const boundary = createLocalBoundary({
    port: config.port,
    execute: runtime.execute,
    logger,
  });

  await boundary.listen();
  boundary.setReady(true);
  logger.log("local_runtime_started", {
    address: config.bindAddress,
    port: config.port,
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.log("local_runtime_stopping", { signal });
    await boundary.close();
    logger.log("local_runtime_stopped");
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM").catch(() => {
      process.exitCode = 1;
    });
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT").catch(() => {
      process.exitCode = 1;
    });
  });
}

void main().catch((error: unknown) => {
  const errorClass = error instanceof Error ? error.name : "UnknownError";
  console.error(JSON.stringify({ event: "local_runtime_startup_failure", errorClass }));
  process.exitCode = 1;
});
