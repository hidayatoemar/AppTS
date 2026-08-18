import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import { apiConfigFromEnv, type ApiConfig, type Env } from "@appts-restore-service/config";
import { createLogger, type Logger } from "@appts-restore-service/observability";
import { registerWorkQueueRoute } from "./routes/work-queue.ts";

const DEP_COMPONENT = "api-dep001";
const SERVICE_WORKER_PATH = "/service-worker.js";
const API_PATH_PREFIX = "/api/";

const defaultStaticRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/dist");

export interface DepBootstrapOptions {
  readonly env?: Env;
  readonly staticRoot?: string;
}

export interface DepBootstrap {
  readonly app: FastifyInstance;
  readonly config: ApiConfig;
  readonly staticRoot: string;
  readonly close: () => Promise<void>;
}

export class DepBootstrapError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DepBootstrapError";
  }
}

function requireStaticBundle(staticRoot: string): void {
  let rootStats: ReturnType<typeof statSync>;
  try {
    rootStats = statSync(staticRoot);
  } catch {
    throw new DepBootstrapError("DEP static bundle directory is unavailable");
  }

  if (!rootStats.isDirectory() || !existsSync(resolve(staticRoot, "index.html")) || !existsSync(resolve(staticRoot, "service-worker.js"))) {
    throw new DepBootstrapError("DEP static bundle is incomplete");
  }
}

function requestPath(request: FastifyRequest): string {
  try {
    return new URL(request.url, "http://dep-bootstrap.invalid").pathname;
  } catch {
    return "";
  }
}

function acceptsHtml(request: FastifyRequest): boolean {
  const accept = request.headers.accept?.toLowerCase();
  // Fastify injection and ordinary browser navigations may omit Accept. A
  // path without an extension is still treated as a navigation in that case;
  // API paths have already been rejected before this helper is reached.
  return accept === undefined || accept.includes("text/html");
}

function sendNotFound(reply: FastifyReply): void {
  reply.callNotFound();
}

function registerDeploymentRoutes(app: FastifyInstance): void {
  app.get("/healthz", async (_request, reply) => {
    return reply.header("Cache-Control", "no-store").send({ status: "ok" });
  });

  app.get("/readyz", async (_request, reply) => {
    return reply.header("Cache-Control", "no-store").send({ status: "ready" });
  });

  app.get(SERVICE_WORKER_PATH, async (_request, reply) => {
    reply.header("Service-Worker-Allowed", "/");
    return reply.sendFile("service-worker.js");
  });

  registerWorkQueueRoute(app);

  // This is deliberately the only catch-all route. It is GET-only, refuses every
  // API path before considering static content, and falls back to index.html only
  // for browser navigations. API methods without a route remain Fastify 404/405s.
  app.get("/*", async (request, reply) => {
    const pathname = requestPath(request);
    if (pathname === "" || pathname === "/api" || pathname.startsWith(API_PATH_PREFIX)) {
      return sendNotFound(reply);
    }

    if (pathname === "/") {
      return reply.sendFile("index.html");
    }

    if (acceptsHtml(request) && !pathname.includes(".")) {
      return reply.sendFile("index.html");
    }

    const assetPath = pathname.replace(/^\/+/, "");
    if (assetPath === "") {
      sendNotFound(reply);
      return;
    }
    return reply.sendFile(assetPath);
  });
}

export async function createDepBootstrapServer(options: DepBootstrapOptions = {}): Promise<DepBootstrap> {
  const logger: Logger = createLogger({ component: DEP_COMPONENT });
  let config: ApiConfig;
  try {
    config = apiConfigFromEnv(options.env ?? process.env);
  } catch (error) {
    // Keep configuration values, especially DATABASE_URL, out of startup logs.
    const details = error as { readonly code?: unknown; readonly field?: unknown };
    logger.error(
      {
        code: typeof details.code === "string" ? details.code : "CONFIG_INVALID",
        field: typeof details.field === "string" ? details.field : "unknown",
      },
      "DEP API configuration rejected",
    );
    throw error;
  }

  const staticRoot = resolve(options.staticRoot ?? defaultStaticRoot);
  try {
    requireStaticBundle(staticRoot);
  } catch (error) {
    logger.error({ reason: "static bundle unavailable" }, "DEP API static bootstrap rejected");
    throw error;
  }

  const app = fastify({ logger: false });
  await app.register(fastifyStatic, {
    root: staticRoot,
    serve: false,
    wildcard: false,
    index: false,
    redirect: false,
  });
  registerDeploymentRoutes(app);

  const close = async (): Promise<void> => {
    await app.close();
    logger.info("DEP API stopped");
  };

  logger.info({ port: config.apiPort, staticBootstrap: "ready" }, "DEP API prepared");
  return Object.freeze({ app, config, staticRoot, close });
}

export async function startDepBootstrap(options: DepBootstrapOptions = {}): Promise<DepBootstrap> {
  const server = await createDepBootstrapServer(options);
  try {
    await server.app.listen({ host: "0.0.0.0", port: server.config.apiPort });
  } catch (error) {
    await server.app.close();
    throw error;
  }
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startDepBootstrap();
  const shutdown = async (): Promise<void> => {
    // The close wrapper owns the shutdown log; signal names are intentionally not
    // included so this path cannot accidentally serialize request/config data.
    await server.close();
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}
