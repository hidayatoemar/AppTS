import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ApiComposition } from "../composition.ts";
import { dispatchUiIntent } from "./ui-intents.ts";
import { readUiProjection } from "./ui-read.ts";

const UI_PREFIX = "/api/v1/ui";
const concernViews = Object.freeze({
  evidence: "UX-RS-05",
  responsibility: "UX-RS-06",
  conditions: "UX-RS-07",
  communication: "UX-RS-08",
  reconciliation: "UX-RS-10",
  closure: "UX-RS-11",
  closed: "UX-RS-12",
  history: "UX-RS-HISTORY",
} as const);

function routeParam(request: FastifyRequest, name: string): string | undefined {
  const params = request.params;
  if (typeof params !== "object" || params === null) return undefined;
  const value = (params as Readonly<Record<string, unknown>>)[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function errorCode(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : "UI_API_INTERNAL_ERROR";
}

function statusFor(code: string): number {
  if (code === "UI_PROJECTION_NOT_AVAILABLE" || code === "DIAGNOSTIC_AUTHORITY_BINDING_REQUIRED") return 501;
  if (code === "TRIAL_DISCLOSURE_CONTEXT_NOT_AUTHORIZED") return 403;
  if (code === "PTX_03_CASE_VERSION_CONFLICT") return 409;
  if (code === "UNREGISTERED_INTENT_CONTRACT" || code === "UI_CONCERN_NOT_FOUND" || code.startsWith("TD_PRE_001_") || code.startsWith("TRIAL_DISCLOSURE_")) return 400;
  return 500;
}

function sendFailure(reply: FastifyReply, error: unknown): FastifyReply {
  const code = errorCode(error);
  return reply.code(statusFor(code)).header("Cache-Control", "no-store").send({ error: code });
}

async function projection(reply: FastifyReply, composition: ApiComposition, viewId: string, subjectRef?: string, concern?: string): Promise<unknown> {
  try {
    return await readUiProjection(composition.projections, viewId, subjectRef, concern);
  } catch (error) {
    return sendFailure(reply, error);
  }
}

export function registerUiHttpRoutes(app: FastifyInstance, composition: ApiComposition): void {
  app.get(`${UI_PREFIX}/work-queue`, async (_request, reply) => projection(reply, composition, "UX-RS-01"));
  app.get(`${UI_PREFIX}/intake`, async (_request, reply) => projection(reply, composition, "UX-RS-02"));
  app.get(`${UI_PREFIX}/intake/:caseId`, async (request, reply) => projection(reply, composition, "UX-RS-02", routeParam(request, "caseId")));
  app.get(`${UI_PREFIX}/tickets/:ticketId`, async (request, reply) => projection(reply, composition, "UX-RS-03", routeParam(request, "ticketId")));
  app.get(`${UI_PREFIX}/tickets/:ticketId/concerns/:concern`, async (request, reply) => {
    const concern = routeParam(request, "concern");
    if (concern === undefined || !(concern in concernViews)) return sendFailure(reply, new Error("UI_CONCERN_NOT_FOUND"));
    const viewId = concernViews[concern as keyof typeof concernViews];
    return projection(reply, composition, viewId, routeParam(request, "ticketId"), concern);
  });
  app.get(`${UI_PREFIX}/incidents/:incidentId`, async (request, reply) => projection(reply, composition, "UX-RS-09", routeParam(request, "incidentId"), "incident"));
  app.get(`${UI_PREFIX}/control`, async (_request, reply) => projection(reply, composition, "UX-RS-13"));
  app.get(`${UI_PREFIX}/executive`, async (_request, reply) => projection(reply, composition, "UX-RS-14"));
  app.get(`${UI_PREFIX}/diagnostics/:referenceId`, async (_request, reply) => sendFailure(reply, new Error("DIAGNOSTIC_AUTHORITY_BINDING_REQUIRED")));

  app.post(`${UI_PREFIX}/intents`, async (request, reply) => {
    try {
      const body = typeof request.body === "object" && request.body !== null ? request.body as Readonly<Record<string, unknown>> : {};
      const result = await dispatchUiIntent(composition.intents, {
        ...(typeof body["intent_contract_ref"] === "string" ? { intent_contract_ref: body["intent_contract_ref"] } : {}),
        payload: body["payload"],
      });
      return reply.header("Cache-Control", "no-store").send(result);
    } catch (error) {
      return sendFailure(reply, error);
    }
  });

  app.post(`${UI_PREFIX}/pending-captures`, async (request, reply) => {
    try {
      const result = await composition.intents.capture(request.body);
      return reply.header("Cache-Control", "no-store").send(result);
    } catch (error) {
      return sendFailure(reply, error);
    }
  });
}
