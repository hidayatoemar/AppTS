export interface SafeDiagnosticPort { retrieve(referenceId:string,authorityContext:unknown):Promise<unknown>; }
export function readSafeDiagnostic(port:SafeDiagnosticPort,referenceId:string,authorityContext:unknown):Promise<unknown>{if(!referenceId)throw new Error("DIAGNOSTIC_REFERENCE_REQUIRED");return port.retrieve(referenceId,authorityContext);}
