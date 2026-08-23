import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export const TLS_DAY3_ALIASES = Object.freeze([
  "trial.ops.a",
  "trial.verify.b",
  "trial.disp.c",
  "trial.close.d",
  "trial.trainer.1",
] as const);
export type TlsDay3Alias = typeof TLS_DAY3_ALIASES[number];

export interface TlsDay3ActorContext {
  readonly alias: TlsDay3Alias;
  readonly trainerOnly: boolean;
  readonly actor_ref?: string;
  readonly role_assignment_ref?: string;
  readonly role_ref?: string;
  readonly holder_ref?: string;
}
export interface TlsDay3SessionContext extends TlsDay3ActorContext { readonly session_ref: string; readonly established_at: string; }

const ACTORS: Readonly<Record<TlsDay3Alias, TlsDay3ActorContext>> = Object.freeze({
  "trial.ops.a": Object.freeze({ alias:"trial.ops.a", trainerOnly:false, actor_ref:"51010000-0000-4000-8000-00000000000a", role_assignment_ref:"51010000-0000-4000-8000-00000000000b", role_ref:"TRIAL-RS-RESPONSIBLE-ROLE-01", holder_ref:"TRIAL-HOLDER-OPS-A" }),
  "trial.verify.b": Object.freeze({ alias:"trial.verify.b", trainerOnly:false, actor_ref:"52010000-0000-4000-8000-000000000012", role_assignment_ref:"52010000-0000-4000-8000-000000000013", role_ref:"TRIAL-RS-VERIFICATION-ROLE-01", holder_ref:"TRIAL-HOLDER-VERIFY-B" }),
  "trial.disp.c": Object.freeze({ alias:"trial.disp.c", trainerOnly:false, actor_ref:"52010000-0000-4000-8000-000000000022", role_assignment_ref:"52010000-0000-4000-8000-000000000023", role_ref:"TRIAL-RS-TERMINAL-DISPOSITION-ROLE-01", holder_ref:"TRIAL-HOLDER-DISP-C" }),
  "trial.close.d": Object.freeze({ alias:"trial.close.d", trainerOnly:false, actor_ref:"52010000-0000-4000-8000-000000000032", role_assignment_ref:"52010000-0000-4000-8000-000000000033", role_ref:"TRIAL-RS-CLOSURE-AUTHORITY-ROLE-01", holder_ref:"TRIAL-HOLDER-CLOSE-D" }),
  "trial.trainer.1": Object.freeze({ alias:"trial.trainer.1", trainerOnly:true, role_ref:"TRIAL-TRAINER-CONTROL-01", holder_ref:"TRIAL-TRAINER-CONTROL-01" }),
});

const COOKIE = "appts_tls_trial_session";
const REGISTRY_ENV = "APPTS_TLS_TRIAL_CREDENTIAL_HASHES_JSON";
const COOKIE_SECURE_ENV = "APPTS_TLS_SESSION_COOKIE_SECURE";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function isAlias(value: unknown): value is TlsDay3Alias { return typeof value === "string" && (TLS_DAY3_ALIASES as readonly string[]).includes(value); }
function parseCookies(header: string | undefined): Readonly<Record<string,string>> { if(!header)return{};const entries=header.split(";").map((part)=>part.trim()).filter(Boolean).map((part)=>{const i=part.indexOf("=");return i<0?[part,""]:[part.slice(0,i),part.slice(i+1)];});return Object.freeze(Object.fromEntries(entries)); }
function parseCredentialRegistry(raw: string | undefined): ReadonlyMap<TlsDay3Alias,string> { if(!raw)return new Map(); let parsed: unknown; try{parsed=JSON.parse(raw);}catch{throw new Error("TLS_DAY3_CREDENTIAL_REGISTRY_INVALID_JSON");} if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("TLS_DAY3_CREDENTIAL_REGISTRY_INVALID"); const map=new Map<TlsDay3Alias,string>(); for(const alias of TLS_DAY3_ALIASES){const value=(parsed as Readonly<Record<string,unknown>>)[alias];if(typeof value==="string"&&value.length>0)map.set(alias,value);} return map; }
function decodeCredentialHash(encoded:string):{salt:Buffer;hash:Buffer}|undefined{const parts=encoded.split("$");if(parts.length!==3||parts[0]!=="scrypt")return undefined;try{const salt=Buffer.from(parts[1]!,"base64url");const hash=Buffer.from(parts[2]!,"base64url");if(!salt.length||hash.length!==32)return undefined;return{salt,hash};}catch{return undefined;}}
export function hashTlsDay3Credential(secret:string,salt:Buffer=randomBytes(16)):string{const hash=scryptSync(secret,salt,32);return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;}
function verifyCredential(secret:string,encoded:string):boolean{const parsed=decodeCredentialHash(encoded);if(!parsed)return false;const candidate=scryptSync(secret,parsed.salt,parsed.hash.length);return candidate.length===parsed.hash.length&&timingSafeEqual(candidate,parsed.hash);}
function cookieValue(reply:FastifyReply,sessionRef:string,secure:boolean):void{const attrs=[`${COOKIE}=${encodeURIComponent(sessionRef)}`,"Path=/","HttpOnly","SameSite=Strict",`Max-Age=${SESSION_MAX_AGE_SECONDS}`];if(secure)attrs.push("Secure");reply.header("Set-Cookie",attrs.join("; "));}
function clearCookie(reply:FastifyReply,secure:boolean):void{const attrs=[`${COOKIE}=`,"Path=/","HttpOnly","SameSite=Strict","Max-Age=0"];if(secure)attrs.push("Secure");reply.header("Set-Cookie",attrs.join("; "));}

export interface TlsDay3TrialAuth {
  readonly configuredAliases: readonly TlsDay3Alias[];
  login(alias:unknown,secret:unknown,request:FastifyRequest,reply:FastifyReply):TlsDay3SessionContext;
  current(request:FastifyRequest):TlsDay3SessionContext|undefined;
  require(request:FastifyRequest):TlsDay3SessionContext;
  requireProduct(request:FastifyRequest):TlsDay3SessionContext;
  requireTrainer(request:FastifyRequest):TlsDay3SessionContext;
  logout(request:FastifyRequest,reply:FastifyReply):void;
  bindProductPayload(payload:unknown,session:TlsDay3SessionContext):Readonly<Record<string,unknown>>;
}

export function createTlsDay3TrialAuth(env:Readonly<Record<string,string|undefined>>=process.env):TlsDay3TrialAuth{
  const registry=parseCredentialRegistry(env[REGISTRY_ENV]);
  const secure=env[COOKIE_SECURE_ENV]?.toLowerCase()!=="false";
  const sessions=new Map<string,TlsDay3SessionContext>();
  const current=(request:FastifyRequest):TlsDay3SessionContext|undefined=>{const ref=parseCookies(request.headers.cookie)[COOKIE];if(!ref)return undefined;return sessions.get(decodeURIComponent(ref));};
  const requireSession=(request:FastifyRequest):TlsDay3SessionContext=>{const session=current(request);if(!session)throw new Error("TLS_DAY3_AUTHENTICATION_REQUIRED");return session;};
  return Object.freeze({
    configuredAliases:Object.freeze([...registry.keys()]),
    login(aliasValue:unknown,secretValue:unknown,request:FastifyRequest,reply:FastifyReply):TlsDay3SessionContext{
      if(!isAlias(aliasValue)||typeof secretValue!=="string"||secretValue.length===0)throw new Error("TLS_DAY3_INVALID_CREDENTIAL");
      const encoded=registry.get(aliasValue);if(!encoded||!verifyCredential(secretValue,encoded))throw new Error("TLS_DAY3_INVALID_CREDENTIAL");
      const existing=current(request);if(existing)sessions.delete(existing.session_ref);
      const sessionRef=randomBytes(32).toString("base64url");const actor=ACTORS[aliasValue];const session:TlsDay3SessionContext=Object.freeze({...actor,session_ref:sessionRef,established_at:new Date().toISOString()});sessions.set(sessionRef,session);cookieValue(reply,sessionRef,secure);return session;
    },
    current,
    require:requireSession,
    requireProduct(request:FastifyRequest):TlsDay3SessionContext{const session=requireSession(request);if(session.trainerOnly)throw new Error("TLS_DAY3_TRAINER_PRODUCT_AUTHORITY_DENIED");return session;},
    requireTrainer(request:FastifyRequest):TlsDay3SessionContext{const session=requireSession(request);if(!session.trainerOnly||session.alias!=="trial.trainer.1")throw new Error("TLS_DAY3_TRAINER_AUTHENTICATION_REQUIRED");return session;},
    logout(request:FastifyRequest,reply:FastifyReply):void{const session=current(request);if(session)sessions.delete(session.session_ref);clearCookie(reply,secure);},
    bindProductPayload(payload:unknown,session:TlsDay3SessionContext):Readonly<Record<string,unknown>>{
      if(session.trainerOnly||!session.actor_ref||!session.role_assignment_ref)throw new Error("TLS_DAY3_PRODUCT_CONTEXT_REQUIRED");
      const value=payload&&typeof payload==="object"&&!Array.isArray(payload)?payload as Readonly<Record<string,unknown>>:{};
      const submittedActor=value["actor_ref"];const submittedAssignment=value["role_assignment_ref"];
      if(submittedActor!==undefined&&submittedActor!==session.actor_ref)throw new Error("TLS_DAY3_CLIENT_ACTOR_TAMPER_DENIED");
      if(submittedAssignment!==undefined&&submittedAssignment!==session.role_assignment_ref)throw new Error("TLS_DAY3_CLIENT_ASSIGNMENT_TAMPER_DENIED");
      return Object.freeze({...value,actor_ref:session.actor_ref,role_assignment_ref:session.role_assignment_ref});
    },
  });
}
