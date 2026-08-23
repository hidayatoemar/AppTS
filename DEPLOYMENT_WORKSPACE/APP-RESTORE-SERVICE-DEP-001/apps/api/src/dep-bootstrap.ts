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
import { registerTlsDay3AuthRoutes } from "./routes/trial-auth-http.ts";
import { registerTlsDay3EndShiftRoute } from "./routes/trial-end-shift-http.ts";
import { registerTlsDay3TrainerRoutes } from "./routes/trial-trainer-http.ts";
import { registerUiHttpRoutes } from "./routes/ui-http.ts";
import { createTrialPreTicketIntentDispatcher } from "./trial/pre-ticket-trial-owner-flow.ts";
import { createTlsDay1GoldenDispatcher } from "./trial/tls-day1-golden-flow.ts";
import { createTlsDay2Arc001Dispatcher } from "./trial/tls-day2-arc001-flow.ts";
import { createTlsDay3Arc002Dispatcher, prepareExistingTlsDay3Closures } from "./trial/tls-day3-arc002-flow.ts";
import { createTlsDay3TrialAuth, type TlsDay3TrialAuth } from "./trial/tls-day3-auth.ts";
import { createTlsDay3TrainerReseedDispatcher } from "./trial/tls-day3-trainer-reseed.ts";

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
function registerDeploymentRoutes(app: FastifyInstance, auth:TlsDay3TrialAuth): void {
  app.get("/healthz", async (_request, reply) => reply.header("Cache-Control", "no-store").send({ status: "ok" }));
  app.get("/readyz", async (_request, reply) => reply.header("Cache-Control", "no-store").send({ status: "ready" }));
  app.get(SERVICE_WORKER_PATH, async (_request, reply) => { reply.header("Service-Worker-Allowed", "/"); return reply.sendFile("service-worker.js"); });
  app.get("/*", async (request, reply) => {
    const pathname = requestPath(request);
    if (pathname === "" || pathname === "/api" || pathname.startsWith(API_PATH_PREFIX)) return sendNotFound(reply);
    const assetPath = pathname.replace(/^\/+/, "");
    if (pathname.includes(".")) return assetPath === "" ? sendNotFound(reply) : reply.sendFile(assetPath);
    if (!acceptsHtml(request)) return sendNotFound(reply);
    if (pathname === "/login") return reply.header("Cache-Control","no-store").sendFile("index.html");
    const session=auth.current(request);
    if(!session)return reply.redirect("/login");
    if(pathname.startsWith("/trainer/")&&!session.trainerOnly)return reply.redirect("/work");
    if(pathname==="/"&&session.trainerOnly)return reply.redirect("/trainer/tls-day2");
    if(pathname==="/"&&!session.trainerOnly)return reply.redirect("/work");
    return reply.header("Cache-Control","no-store").sendFile("index.html");
  });
}

export async function createDepBootstrapServer(options: DepBootstrapOptions = {}): Promise<DepBootstrap> {
  const logger: Logger = createLogger({ component: DEP_COMPONENT }); let config: ApiConfig;
  try { config = apiConfigFromEnv(options.env ?? process.env); } catch (error) { const details = error as { readonly code?: unknown; readonly field?: unknown }; logger.error({ code: typeof details.code === "string" ? details.code : "CONFIG_INVALID", field: typeof details.field === "string" ? details.field : "unknown" }, "DEP API configuration rejected"); throw error; }
  const staticRoot = resolve(options.staticRoot ?? defaultStaticRoot); try { requireStaticBundle(staticRoot); } catch (error) { logger.error({ reason: "static bundle unavailable" }, "DEP API static bootstrap rejected"); throw error; }
  const auth=createTlsDay3TrialAuth((options.env??process.env) as Readonly<Record<string,string|undefined>>);
  const ownedPool = options.composition === undefined && options.pool === undefined ? createPersistencePool({ connectionString: config.databaseUrl }) : undefined;
  const pool = options.pool ?? ownedPool;
  const fallbackIntents = pool === undefined ? undefined : createTrialPreTicketIntentDispatcher(pool);
  const day1Intents = pool === undefined ? undefined : createTlsDay1GoldenDispatcher(pool, fallbackIntents!);
  const day2Intents = pool === undefined ? undefined : createTlsDay2Arc001Dispatcher(pool, day1Intents!);
  const day3Intents = pool === undefined ? undefined : createTlsDay3Arc002Dispatcher(pool, day2Intents!);
  const trainerIntents = pool === undefined ? undefined : createTlsDay3TrainerReseedDispatcher(day3Intents!);
  const composition = options.composition ?? composeApi({ projections: createTrialProjectionPort(pool!), intents: trainerIntents!, diagnostics: Object.freeze({ async retrieve(): Promise<never> { throw new Error("DIAGNOSTIC_AUTHORITY_BINDING_REQUIRED"); } }) });
  if(pool!==undefined&&options.composition===undefined)await prepareExistingTlsDay3Closures(pool);
  const app = fastify({ logger: false });
  await app.register(fastifyStatic, { root: staticRoot, serve: false, wildcard: false, index: false, redirect: false });
  registerTlsDay3AuthRoutes(app,auth,pool);if(pool!==undefined){registerTlsDay3EndShiftRoute(app,pool,auth);registerTlsDay3TrainerRoutes(app,pool,auth);}registerUiHttpRoutes(app, composition,auth);registerDeploymentRoutes(app,auth);
  const close = async (): Promise<void> => { await app.close(); if (ownedPool !== undefined) await ownedPool.end(); logger.info("DEP API stopped"); };
  logger.info({ port: config.apiPort, staticBootstrap: "ready", uiComposition: "registered", trialAuthAliasesConfigured:auth.configuredAliases.length }, "DEP API prepared");
  return Object.freeze({ app, config, staticRoot, composition, close });
}
export async function startDepBootstrap(options: DepBootstrapOptions = {}): Promise<DepBootstrap> { const server = await createDepBootstrapServer(options); try { await server.app.listen({ host: "0.0.0.0", port: server.config.apiPort }); } catch (error) { await server.app.close(); throw error; } return server; }
if (process.argv[1] === fileURLToPath(import.meta.url)) { const server = await startDepBootstrap(); const shutdown = async (): Promise<void> => { await server.close(); }; process.once("SIGTERM", () => void shutdown()); process.once("SIGINT", () => void shutdown()); }
