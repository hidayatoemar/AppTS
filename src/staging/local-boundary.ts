import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerAddress,
  type ServerResponse,
} from "node:http";
import type { ActionCommandEnvelope, PurposeInstanceRef, ScopeRef } from "../contracts/ce-di.js";
import type { CommandPipelineResult } from "../runtime/command-pipeline.js";
import { RS_A_022 } from "../runtime/rs-a-022-binding.js";
import { LOOPBACK_ADDRESS } from "./runtime-config.js";

const MAX_BODY_BYTES = 64 * 1024;

export interface InfrastructureLogger {
  log(event: string, fields?: Readonly<Record<string, string | number | boolean>>): void;
}

export interface LocalBoundary {
  listen(): Promise<void>;
  close(): Promise<void>;
  setReady(value: boolean): void;
  address(): ServerAddress | string | null;
}

export interface LocalBoundaryOptions {
  port: number;
  execute(envelope: ActionCommandEnvelope): Promise<CommandPipelineResult>;
  logger?: InfrastructureLogger;
}

class TransportInputError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 = 400,
  ) {
    super(message);
    this.name = "TransportInputError";
  }
}

const NOOP_LOGGER: InfrastructureLogger = { log: () => undefined };

export function createLocalBoundary(options: LocalBoundaryOptions): LocalBoundary {
  const logger = options.logger ?? NOOP_LOGGER;
  let ready = false;
  let active = false;

  const server = createServer((request, response) => {
    void handleRequest(request, response, options.execute, logger, () => ready);
  });

  return {
    listen: async () => {
      if (active) return;
      await new Promise<void>((resolve, reject) => {
        const onError = (error: unknown) => reject(error);
        server.once("error", onError);
        server.listen(options.port, LOOPBACK_ADDRESS, () => {
          server.off("error", onError);
          active = true;
          resolve();
        });
      });
    },
    close: async () => {
      if (!active) return;
      ready = false;
      await new Promise<void>((resolve) => server.close(() => resolve()));
      active = false;
    },
    setReady: (value) => {
      ready = value;
    },
    address: () => server.address(),
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  execute: (envelope: ActionCommandEnvelope) => Promise<CommandPipelineResult>,
  logger: InfrastructureLogger,
  readiness: () => boolean,
): Promise<void> {
  const method = request.method ?? "";
  const path = request.url ?? "";

  if (method === "GET" && path === "/healthz") {
    writeJson(response, 200, { alive: true });
    logger.log("transport_outcome", { method, path, status: 200 });
    return;
  }

  if (method === "GET" && path === "/readyz") {
    const ready = readiness();
    writeJson(response, ready ? 200 : 503, {
      ready,
      runtimeConfigLoaded: ready,
      persistenceReplayComplete: ready,
      localListenerActive: true,
    });
    logger.log("transport_outcome", { method, path, status: ready ? 200 : 503 });
    return;
  }

  if (method !== "POST" || path !== "/commands") {
    writeJson(response, 404, { error: "NOT_FOUND" });
    logger.log("transport_outcome", { method, path, status: 404 });
    return;
  }

  const rawContentType = request.headers["content-type"];
  const contentType = Array.isArray(rawContentType) ? rawContentType[0] : rawContentType;
  if (!contentType || !isAcceptedJsonContentType(contentType)) {
    writeJson(response, 400, { error: "APPLICATION_JSON_REQUIRED" });
    logger.log("transport_outcome", { method, path, status: 400 });
    return;
  }

  let commandId: string | undefined;
  try {
    const body = await readJsonBody(request);
    const envelope = parseCommandEnvelope(body);
    commandId = envelope.commandId;
    const result = await execute(envelope);
    writeJson(response, 200, result);
    logger.log("transport_outcome", { method, path, status: 200, commandId });
  } catch (error) {
    if (error instanceof TransportInputError) {
      writeJson(response, error.status, { error: error.message });
      logger.log("transport_outcome", { method, path, status: error.status });
      return;
    }
    if (error instanceof Error && error.message === "IMPLEMENTATION_REPLAY_CONFLICT") {
      writeJson(response, 409, { error: "IMPLEMENTATION_REPLAY_CONFLICT" });
      logger.log("transport_outcome", {
        method,
        path,
        status: 409,
        ...(commandId === undefined ? {} : { commandId }),
      });
      return;
    }
    writeJson(response, 500, { error: "LOCAL_RUNTIME_FAILURE" });
    logger.log("transport_outcome", {
      method,
      path,
      status: 500,
      ...(commandId === undefined ? {} : { commandId }),
    });
  }
}

function isAcceptedJsonContentType(contentType: string): boolean {
  return /^application\/json(?:\s*;\s*charset\s*=\s*(?:"utf-8"|utf-8))?$/i.test(contentType.trim());
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    let body = "";
    let bodyBytes = 0;
    let settled = false;
    const encoder = new TextEncoder();
    request.setEncoding("utf8");

    request.on("data", (chunk) => {
      if (settled) return;
      bodyBytes += encoder.encode(chunk).byteLength;
      if (bodyBytes > MAX_BODY_BYTES) {
        settled = true;
        reject(new TransportInputError("BODY_TOO_LARGE", 413));
        return;
      }
      body += chunk;
    });

    request.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(body) as unknown);
      } catch {
        reject(new TransportInputError("MALFORMED_JSON"));
      }
    });

    request.on("error", () => {
      if (settled) return;
      settled = true;
      reject(new Error("REQUEST_STREAM_FAILURE"));
    });
  });
}

export function parseCommandEnvelope(value: unknown): ActionCommandEnvelope {
  const record = asRecord(value, "INVALID_COMMAND_BODY");
  assertExactKeys(
    record,
    [
      "commandId",
      "actionId",
      "purposeRef",
      "scopeRef",
      "requestedByActorOrMachineRef",
      "expectedInputVersion",
      "requestTime",
      "evidenceRefs",
    ],
    ["actingContextRef", "boundedMachineAuthorityRef", "payloadRef"],
  );

  const commandId = requiredString(record.commandId, "commandId");
  const actionId = requiredString(record.actionId, "actionId");
  if (actionId !== RS_A_022) throw new TransportInputError("STAGING_ACTION_NOT_ADMITTED");

  const purposeRef = parsePurposeRef(record.purposeRef);
  const scopeRef = parseScopeRef(record.scopeRef);
  if (scopeRef.subjectType !== "SERVICE") throw new TransportInputError("STAGING_SERVICE_SCOPE_ONLY");

  const requestedByActorOrMachineRef = requiredString(
    record.requestedByActorOrMachineRef,
    "requestedByActorOrMachineRef",
  );
  if (!Number.isInteger(record.expectedInputVersion) || typeof record.expectedInputVersion !== "number" || record.expectedInputVersion < 0) {
    throw new TransportInputError("INVALID_expectedInputVersion");
  }
  const requestTime = requiredString(record.requestTime, "requestTime");
  const evidenceRefs = requiredStringArray(record.evidenceRefs, "evidenceRefs");

  return {
    commandId,
    actionId,
    purposeRef,
    scopeRef,
    requestedByActorOrMachineRef,
    ...(record.actingContextRef === undefined
      ? {}
      : { actingContextRef: requiredString(record.actingContextRef, "actingContextRef") }),
    ...(record.boundedMachineAuthorityRef === undefined
      ? {}
      : {
          boundedMachineAuthorityRef: requiredString(
            record.boundedMachineAuthorityRef,
            "boundedMachineAuthorityRef",
          ),
        }),
    expectedInputVersion: record.expectedInputVersion,
    requestTime,
    ...(record.payloadRef === undefined ? {} : { payloadRef: requiredString(record.payloadRef, "payloadRef") }),
    evidenceRefs,
  };
}

function parsePurposeRef(value: unknown): PurposeInstanceRef {
  const record = asRecord(value, "INVALID_PURPOSE_REF");
  assertExactKeys(record, ["purpose", "situationId", "compositionInstanceId", "startedFromBasisRef"]);
  if (record.purpose !== "RESTORE_SERVICE") throw new TransportInputError("STAGING_PURPOSE_NOT_ADMITTED");
  return {
    purpose: "RESTORE_SERVICE",
    situationId: requiredString(record.situationId, "purposeRef.situationId"),
    compositionInstanceId: requiredString(record.compositionInstanceId, "purposeRef.compositionInstanceId"),
    startedFromBasisRef: requiredString(record.startedFromBasisRef, "purposeRef.startedFromBasisRef"),
  };
}

function parseScopeRef(value: unknown): ScopeRef {
  const record = asRecord(value, "INVALID_SCOPE_REF");
  assertExactKeys(record, ["situationId", "subjectType", "subjectId"], ["parentScopeRef", "relationRef"]);
  return {
    situationId: requiredString(record.situationId, "scopeRef.situationId"),
    subjectType: requiredString(record.subjectType, "scopeRef.subjectType"),
    subjectId: requiredString(record.subjectId, "scopeRef.subjectId"),
    ...(record.parentScopeRef === undefined
      ? {}
      : { parentScopeRef: requiredString(record.parentScopeRef, "scopeRef.parentScopeRef") }),
    ...(record.relationRef === undefined
      ? {}
      : { relationRef: requiredString(record.relationRef, "scopeRef.relationRef") }),
  };
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TransportInputError(message);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  record: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!(key in record)) throw new TransportInputError(`MISSING_FIELD:${key}`);
  }
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new TransportInputError(`UNKNOWN_FIELD:${key}`);
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) throw new TransportInputError(`INVALID_${field}`);
  return value;
}

function requiredStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new TransportInputError(`INVALID_${field}`);
  }
  return [...value];
}

function writeJson(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}
