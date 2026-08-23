import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import { createPersistencePool, type PersistencePool } from "@appts-restore-service/persistence";
import { apiConfigFromEnv, type ApiConfig, type Env } from "@appts-restore-service/config";
import { createLogger, type Logger } from "@appts-restore-service/observability";
import { composeApi, type ApiComposition } from "./composition.ts";
import { createTrialProjectionPort } from "./projections/trial-projection-port.ts";
import { registerUiHttpRoutes } from "./routes/ui-http.ts";
import { createTrialPreTicketIntentDispatcher } from "./trial/pre-ticket-trial-owner-flow.ts";
import { createTlsDay1GoldenDispatcher } from "./trial/tls-day1-golden-flow.ts";
import { createTlsDay2Arc001Dispatcher } from "./trial/tls-day2-arc001-flow.ts";

const DEP_COMPONENT = "api-dep001";
const SERVICE_WORKER_PATH = "/service-worker.js";
const API_PATH_PREFIX = "/api/";
const defaultStaticRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/dist");

export interface DepBootstrapOptions { readonly env?: Env; readonly staticRoot?: string; readonly composition?: ApiComposition; readonly pool?: PersistencePool; }
export interface DepBootstrap { readonly app: FastifyInstance; readonly config: ApiConfig; readonly staticRoot: string; readonly composition: ApiComposition; readonly close: () => Promise<void>; }
export class DepBootstrapError extends Error { public constructor(message: string) { super(message); this.name = "DepBootstrapError"; } }
function requireStaticBundle(staticRoot: string): void { let rootStats: ReturnType<typeof statSync>; try { rootStats = statSync(staticRoot); } catch { throw new DepBootstrapError("DEP static bundle directory is unavailable"); } if (!rootStats.isDirectory() || !existsSync(resolve(staticRoot, "index.html")) || !existsSync(resolve(staticRoot, "service-worker.js"))) throw new DepBootstrapError("DEP static bundle is incomplete"); }
function requestPath(request: FastifyRequest): string { try { return new URL(request.url, "http://dep-bootstrap.invalid").pathname; } catch { return ""; } }
function acceptsHtml(request: FastifyRequest): boolean { const accept = request.headers.accept?.toLowerCase(); return accept === undefined || accept.includes("text/html"); }
function sendNotFound(reply: FastifyReply): void { reply.callNotFound(); }
function registerDeploymentRoutes(app: FastifyInstance): void {
  app.get("/healthz", async (_request, reply) => reply.header("Cache-Control", "no-store").send({ status: "ok" }));
  app.get("/readyz", async (_request, reply) => reply.header("Cache-Control", "no-store").send({ status: "ready" }));
  app.get(SERVICE_WORKER_PATH, async (_request, reply) => { reply.header("Service-Worker-Allowed", "/"); return reply.sendFile("service-worker.js"); });
  app.get("/*", async (request, reply) => { const pathname = requestPath(request); if (pathname === "" || pathname === "/api" || pathname.startsWith(API_PATH_PREFIX)) return sendNotFound(reply); if (pathname === "/") return reply.sendFile("index.html"); if (acceptsHtml(request) && !pathname.includes(".")) return reply.sendFile("index.html"); const assetPath = pathname.replace(/^\/+/, ""); if (assetPath === "") { sendNotFound(reply); return; } return reply.sendFile(assetPath); });
}

export async function createDepBootstrapServer(options: DepBootstrapOptions = {}): Promise<DepBootstrap> {
  const logger: Logger = createLogger({ component: DEP_COMPONENT }); let config: ApiConfig;
  try { config = apiConfigFromEnv(options.env ?? process.env); } catch (error) { const details = error as { readonly code?: unknown; readonly field?: unknown }; logger.error({ code: typeof details.code === "string" ? details.code : "CONFIG_INVALID", field: typeof details.field === "string" ? details.field : "unknown" }, "DEP API configuration rejected"); throw error; }
  const staticRoot = resolve(options.staticRoot ?? defaultStaticRoot); try { requireStaticBundle(staticRoot); } catch (error) { logger.error({ reason: "static bundle unavailable" }, "DEP API static bootstrap rejected"); throw error; }
  const ownedPool = options.composition === undefined && options.pool === undefined ? createPersistencePool({ connectionString: config.databaseUrl }) : undefined;
  const pool = options.pool ?? ownedPool;
  const fallbackIntents = pool === undefined ? undefined : createTrialPreTicketIntentDispatcher(pool);
  const day1Intents = pool === undefined ? undefined : createTlsDay1GoldenDispatcher(pool, fallbackIntents!);
  const composition = options.composition ?? composeApi({
    projections: createTrialProjectionPort(pool!),
    intents: createTlsDay2Arc001Dispatcher(pool!, day1Intents!),
    diagnostics: Object.freeze({ async retrieve(): Promise<never> { throw new Error("DIAGNOSTIC_AUTHORITY_BINDING_REQUIRED"); } }),
  });
  const app = fastify({ logger: false });
  await app.register(fastifyStatic, { root: staticRoot, serve: false, wildcard: false, index: false, redirect: false });
  registerUiHttpRoutes(app, composition); registerDeploymentRoutes(app);
  const close = async (): Promise<void> => { await app.close(); if (ownedPool !== undefined) await ownedPool.end(); logger.info("DEP API stopped"); };
  logger.info({ port: config.apiPort, staticBootstrap: "ready", uiComposition: "registered" }, "DEP API prepared");
  return Object.freeze({ app, config, staticRoot, composition, close });
}
export async function startDepBootstrap(options: DepBootstrapOptions = {}): Promise<DepBootstrap> { const server = await createDepBootstrapServer(options); try { await server.app.listen({ host: "0.0.0.0", port: server.config.apiPort }); } catch (error) { await server.app.close(); throw error; } return server; }
if (process.argv[1] === fileURLToPath(import.meta.url)) { const server = await startDepBootstrap(); const shutdown = async (): Promise<void> => { await server.close(); }; process.once("SIGTERM", () => void shutdown()); process.once("SIGINT", () => void shutdown()); }
