export const UI_INTENT_PATH="/api/v1/ui/intents" as const;export const UI_PENDING_CAPTURE_PATH="/api/v1/ui/pending-captures" as const;
export interface UiIntentDispatcher { dispatch(contractRef:string,payload:unknown):Promise<unknown>;capture(payload:unknown):Promise<unknown>; }
export async function dispatchUiIntent(port:UiIntentDispatcher,envelope:{intent_contract_ref?:string;payload?:unknown}):Promise<unknown>{if(!envelope.intent_contract_ref)throw new Error("UNREGISTERED_INTENT_CONTRACT");return port.dispatch(envelope.intent_contract_ref,envelope.payload);}
