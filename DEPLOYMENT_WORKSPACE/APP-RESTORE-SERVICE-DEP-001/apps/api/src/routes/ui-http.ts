import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ApiComposition } from "../composition.ts";
import { TLS_DAY2_TRAINER_INTENT } from "../trial/tls-day2-arc001-flow.ts";
import type { TlsDay3SessionContext, TlsDay3TrialAuth } from "../trial/tls-day3-auth.ts";
import { dispatchUiIntent } from "./ui-intents.ts";
import { readUiProjection, type UiReadContext } from "./ui-read.ts";

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
function asReadContext(session:TlsDay3SessionContext):UiReadContext{return Object.freeze({alias:session.alias,trainerOnly:session.trainerOnly,...(session.actor_ref?{actor_ref:session.actor_ref}:{}),...(session.role_assignment_ref?{role_assignment_ref:session.role_assignment_ref}:{}),...(session.role_ref?{role_ref:session.role_ref}:{}),...(session.holder_ref?{holder_ref:session.holder_ref}:{})});}
function errorCode(error: unknown): string { return error instanceof Error && error.message.length > 0 ? error.message : "UI_API_INTERNAL_ERROR"; }
function statusFor(code: string): number {
  if (code === "TLS_DAY3_AUTHENTICATION_REQUIRED" || code === "TLS_DAY3_INVALID_CREDENTIAL") return 401;
  if (code.startsWith("TLS_DAY3_") || code === "TRIAL_DISCLOSURE_CONTEXT_NOT_AUTHORIZED") return 403;
  if (code === "UI_PROJECTION_NOT_AVAILABLE" || code === "DIAGNOSTIC_AUTHORITY_BINDING_REQUIRED") return 501;
  if (code === "PTX_03_CASE_VERSION_CONFLICT") return 409;
  if (code === "UNREGISTERED_INTENT_CONTRACT" || code === "UI_CONCERN_NOT_FOUND" || code.startsWith("TD_PRE_001_") || code.startsWith("TRIAL_DISCLOSURE_")) return 400;
  return 500;
}
function sendFailure(reply: FastifyReply, error: unknown): FastifyReply { const code = errorCode(error); return reply.code(statusFor(code)).header("Cache-Control", "no-store").send({ error: code }); }
async function projection(reply: FastifyReply, composition: ApiComposition, viewId: string, context:UiReadContext, subjectRef?: string, concern?: string): Promise<unknown> { try { return await readUiProjection(composition.projections, viewId, subjectRef, concern, context); } catch (error) { return sendFailure(reply, error); } }

export function registerUiHttpRoutes(app: FastifyInstance, composition: ApiComposition, auth:TlsDay3TrialAuth): void {
  app.get(`${UI_PREFIX}/work-queue`, async (request, reply) => {try{return projection(reply,composition,"UX-RS-01",asReadContext(auth.requireProduct(request)));}catch(error){return sendFailure(reply,error);}});
  app.get(`${UI_PREFIX}/intake`, async (request, reply) => {try{return projection(reply,composition,"UX-RS-02",asReadContext(auth.requireProduct(request)));}catch(error){return sendFailure(reply,error);}});
  app.get(`${UI_PREFIX}/intake/:caseId`, async (request, reply) => {try{return projection(reply,composition,"UX-RS-02",asReadContext(auth.requireProduct(request)),routeParam(request,"caseId"));}catch(error){return sendFailure(reply,error);}});
  app.get(`${UI_PREFIX}/tickets/:ticketId`, async (request, reply) => {try{return projection(reply,composition,"UX-RS-03",asReadContext(auth.require(request)),routeParam(request,"ticketId"));}catch(error){return sendFailure(reply,error);}});
  app.get(`${UI_PREFIX}/tickets/:ticketId/concerns/:concern`, async (request, reply) => {try{const session=auth.requireProduct(request);const concern=routeParam(request,"concern");if(concern===undefined||!(concern in concernViews))return sendFailure(reply,new Error("UI_CONCERN_NOT_FOUND"));const viewId=concernViews[concern as keyof typeof concernViews];return projection(reply,composition,viewId,asReadContext(session),routeParam(request,"ticketId"),concern);}catch(error){return sendFailure(reply,error);}});
  app.get(`${UI_PREFIX}/incidents/:incidentId`, async (request, reply) => {try{return projection(reply,composition,"UX-RS-09",asReadContext(auth.requireProduct(request)),routeParam(request,"incidentId"),"incident");}catch(error){return sendFailure(reply,error);}});
  app.get(`${UI_PREFIX}/control`, async (request, reply) => {try{return projection(reply,composition,"UX-RS-13",asReadContext(auth.requireProduct(request)));}catch(error){return sendFailure(reply,error);}});
  app.get(`${UI_PREFIX}/executive`, async (request, reply) => {try{return projection(reply,composition,"UX-RS-14",asReadContext(auth.requireProduct(request)));}catch(error){return sendFailure(reply,error);}});
  app.get(`${UI_PREFIX}/diagnostics/:referenceId`, async (request, reply) => {try{auth.requireProduct(request);return sendFailure(reply,new Error("DIAGNOSTIC_AUTHORITY_BINDING_REQUIRED"));}catch(error){return sendFailure(reply,error);}});

  app.post(`${UI_PREFIX}/intents`, async (request, reply) => {
    try {
      const body = typeof request.body === "object" && request.body !== null ? request.body as Readonly<Record<string, unknown>> : {};
      const contract=typeof body["intent_contract_ref"] === "string"?body["intent_contract_ref"]:undefined;
      const payload=contract===TLS_DAY2_TRAINER_INTENT?(auth.requireTrainer(request),body["payload"]):auth.bindProductPayload(body["payload"],auth.requireProduct(request));
      const result = await dispatchUiIntent(composition.intents, { ...(contract?{intent_contract_ref:contract}:{}), payload });
      return reply.header("Cache-Control", "no-store").send(result);
    } catch (error) { return sendFailure(reply, error); }
  });

  app.post(`${UI_PREFIX}/pending-captures`, async (request, reply) => { try { auth.requireProduct(request); const result = await composition.intents.capture(request.body); return reply.header("Cache-Control", "no-store").send(result); } catch (error) { return sendFailure(reply, error); } });
}
