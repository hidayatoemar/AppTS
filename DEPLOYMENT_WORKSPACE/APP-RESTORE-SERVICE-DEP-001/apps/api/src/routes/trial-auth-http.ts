import type { FastifyInstance, FastifyReply } from "fastify";
import type { PersistencePool } from "@appts-restore-service/persistence";
import type { TlsDay3SessionContext, TlsDay3TrialAuth } from "../trial/tls-day3-auth.ts";

const AUTH_PREFIX = "/api/v1/auth";
const PURPOSE_BINDING = "51010000-0000-4000-8000-000000000005";
const DOMAIN = "51010000-0000-4000-8000-000000000007";
const DISCLOSURE = "6f79da70-412f-469e-bcf7-f544f81b8aa7";
function publicSession(session:TlsDay3SessionContext):Readonly<Record<string,unknown>>{return Object.freeze({authenticated:true,alias:session.alias,trainer_only:session.trainerOnly,role_ref:session.role_ref??null,holder_ref:session.holder_ref??null,established_at:session.established_at});}
function failure(reply:FastifyReply,error:unknown):FastifyReply{const code=error instanceof Error?error.message:"TLS_DAY3_AUTH_ERROR";const status=code==="TLS_DAY3_INVALID_CREDENTIAL"||code==="TLS_DAY3_AUTHENTICATION_REQUIRED"?401:403;return reply.code(status).header("Cache-Control","no-store").send({error:code});}
async function requireCurrentProductBinding(pool:PersistencePool|undefined,session:TlsDay3SessionContext):Promise<void>{
  if(session.trainerOnly)return;
  if(!pool)throw new Error("TLS_DAY3_BINDING_STORE_UNAVAILABLE");
  if(!session.actor_ref||!session.role_assignment_ref||!session.role_instance_ref||!session.assignment_snapshot_ref)throw new Error("TLS_DAY3_PRODUCT_BINDING_INCOMPLETE");
  const result=await pool.query<{binding_count:string}>(`SELECT count(*)::text AS binding_count
    FROM appts.assignment_snapshot a
    JOIN appts.source_version_ref sv ON sv.source_version_ref_id=a.source_version_ref_id
   WHERE a.assignment_snapshot_id=$1
     AND a.role_instance_ref=$2
     AND a.holder_ref=$3
     AND a.assignment_ref=$4
     AND a.purpose_binding_id=$5
     AND a.domain_id=$6
     AND a.disclosure_label_ref=$7
     AND a.verified_at IS NOT NULL
     AND (a.eligible_from IS NULL OR a.eligible_from<=now())
     AND (a.eligible_to IS NULL OR a.eligible_to>now())
     AND (a.effective_from IS NULL OR a.effective_from<=now())
     AND (a.effective_to IS NULL OR a.effective_to>now())
     AND sv.currentness_ref='CURRENT'
     AND (sv.effective_from IS NULL OR sv.effective_from<=now())
     AND (sv.effective_to IS NULL OR sv.effective_to>now())`,[session.assignment_snapshot_ref,session.role_instance_ref,session.actor_ref,session.role_assignment_ref,PURPOSE_BINDING,DOMAIN,DISCLOSURE]);
  if(Number(result.rows[0]?.binding_count??0)!==1)throw new Error("TLS_DAY3_PRODUCT_BINDING_NOT_CURRENT");
}

export function registerTlsDay3AuthRoutes(app:FastifyInstance,auth:TlsDay3TrialAuth,pool?:PersistencePool):void{
  app.post(`${AUTH_PREFIX}/login`,async(request,reply)=>{let session:TlsDay3SessionContext|undefined;try{const body=request.body&&typeof request.body==="object"?request.body as Readonly<Record<string,unknown>>:{};session=auth.login(body["alias"],body["credential"],request,reply);await requireCurrentProductBinding(pool,session);return reply.header("Cache-Control","no-store").send(publicSession(session));}catch(error){if(session)auth.invalidate(session.session_ref,reply);return failure(reply,error);}});
  app.get(`${AUTH_PREFIX}/session`,async(request,reply)=>{try{const session=auth.require(request);await requireCurrentProductBinding(pool,session);return reply.header("Cache-Control","no-store").send(publicSession(session));}catch(error){return failure(reply,error);}});
  app.post(`${AUTH_PREFIX}/logout`,async(request,reply)=>{auth.logout(request,reply);return reply.header("Cache-Control","no-store").send({authenticated:false});});
}
