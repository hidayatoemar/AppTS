export const UI_INTENT_PATH="/api/v1/ui/intents" as const;export const UI_PENDING_CAPTURE_PATH="/api/v1/ui/pending-captures" as const;
export const PRE_TICKET_ADMISSION_INTENT="APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION / 1.0.0" as const;
export {TD_PRE_001_DISCLOSURE_CONTROL_REF,TD_PRE_001_DISCLOSURE_LABEL_REF,TD_PRE_001_TRIAL_CONTEXT,TRIAL_DISCLOSURE_CONFIGURATION_KEY,resolveTrialDisclosureLabelRef}from"./trial-disclosure-binding.ts";
export interface UiIntentDispatcher { dispatch(contractRef:string,payload:unknown):Promise<unknown>;capture(payload:unknown):Promise<unknown>; }
export async function dispatchUiIntent(port:UiIntentDispatcher,envelope:{intent_contract_ref?:string;payload?:unknown}):Promise<unknown>{if(!envelope.intent_contract_ref)throw new Error("UNREGISTERED_INTENT_CONTRACT");return port.dispatch(envelope.intent_contract_ref,envelope.payload);}

/** The existing UI transport accepts this contract only through its registered dispatcher. */
export function createPreTicketIntentDispatcher(submit:(payload:unknown)=>Promise<unknown>):UiIntentDispatcher{
  return Object.freeze({
    async dispatch(contractRef:string,payload:unknown):Promise<unknown>{
      if(contractRef!==PRE_TICKET_ADMISSION_INTENT)throw new Error("UNREGISTERED_INTENT_CONTRACT");
      return submit(payload);
    },
    async capture():Promise<never>{throw new Error("PENDING_CAPTURE_NOT_BOUND_FOR_PRETICKET");},
  });
}
