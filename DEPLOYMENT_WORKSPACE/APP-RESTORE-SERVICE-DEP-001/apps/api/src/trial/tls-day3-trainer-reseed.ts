import { randomUUID } from "node:crypto";
import { PRE_TICKET_ADMISSION_INTENT, type UiIntentDispatcher } from "../routes/ui-intents.ts";

export const TLS_DAY3_TRAINER_RESEED_INTENT="APPTS.TLS.DAY3.TRAINER.RESEED_RUN / 1.0.0" as const;
const DAY1_TRIAL_CONTEXT="TLS-DAY1-GOLDEN" as const;
function scenarioRunRef(payload:unknown):string{if(!payload||typeof payload!=="object")throw new Error("TLS_DAY3_RESEED_PAYLOAD_REQUIRED");const value=(payload as Readonly<Record<string,unknown>>)["scenarioRunRef"];if(typeof value!=="string"||value.length===0)throw new Error("TLS_DAY3_RESEED_RUN_REF_REQUIRED");return value;}
export function createTlsDay3TrainerReseedDispatcher(fallback:UiIntentDispatcher):UiIntentDispatcher{return Object.freeze({
  async dispatch(contractRef:string,payload:unknown):Promise<unknown>{
    if(contractRef!==TLS_DAY3_TRAINER_RESEED_INTENT)return fallback.dispatch(contractRef,payload);
    const runRef=scenarioRunRef(payload);const correlationId=randomUUID();
    const result=await fallback.dispatch(PRE_TICKET_ADMISSION_INTENT,Object.freeze({messageId:randomUUID(),idempotencyKey:`TLS-D3-RESEED:${runRef}`,correlationId,trialContext:DAY1_TRIAL_CONTEXT}));
    const value=result&&typeof result==="object"?result as Readonly<Record<string,unknown>>:{};
    return Object.freeze({result:"ACK",durable:true,control:"FRESH_GOVERNED_RUN",scenarioRunRef:runRef,downstreamDisposition:value["disposition"]??"UNKNOWN",ticketId:value["ticketId"]??null,state:value["state"]??null,authorityPosture:"TRAINER_ISSUED_SIMULATOR_INPUT_D01_GOVERNS_TICKET_FORMATION"});
  },
  async capture(payload:unknown):Promise<unknown>{return fallback.capture(payload);},
});}
