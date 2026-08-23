import type { FastifyInstance, FastifyReply } from "fastify";
import type { TlsDay3SessionContext, TlsDay3TrialAuth } from "../trial/tls-day3-auth.ts";

const AUTH_PREFIX = "/api/v1/auth";
function publicSession(session:TlsDay3SessionContext):Readonly<Record<string,unknown>>{return Object.freeze({authenticated:true,alias:session.alias,trainer_only:session.trainerOnly,role_ref:session.role_ref??null,holder_ref:session.holder_ref??null,binding_authority_ref:session.binding_authority_ref,binding_currentness:session.binding_currentness,established_at:session.established_at});}
function failure(reply:FastifyReply,error:unknown):FastifyReply{const code=error instanceof Error?error.message:"TLS_DAY3_AUTH_ERROR";const status=code==="TLS_DAY3_INVALID_CREDENTIAL"||code==="TLS_DAY3_AUTHENTICATION_REQUIRED"?401:403;return reply.code(status).header("Cache-Control","no-store").send({error:code});}

export function registerTlsDay3AuthRoutes(app:FastifyInstance,auth:TlsDay3TrialAuth):void{
  app.post(`${AUTH_PREFIX}/login`,async(request,reply)=>{let session:TlsDay3SessionContext|undefined;try{const body=request.body&&typeof request.body==="object"?request.body as Readonly<Record<string,unknown>>:{};session=auth.login(body["alias"],body["credential"],request,reply);return reply.header("Cache-Control","no-store").send(publicSession(session));}catch(error){if(session)auth.invalidate(session.session_ref,reply);return failure(reply,error);}});
  app.get(`${AUTH_PREFIX}/session`,async(request,reply)=>{try{const session=auth.require(request);return reply.header("Cache-Control","no-store").send(publicSession(session));}catch(error){return failure(reply,error);}});
  app.post(`${AUTH_PREFIX}/logout`,async(request,reply)=>{auth.logout(request,reply);return reply.header("Cache-Control","no-store").send({authenticated:false});});
}
