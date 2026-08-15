import type { UiProjectionPort } from "./routes/ui-read.ts";import type { UiIntentDispatcher } from "./routes/ui-intents.ts";import type { SafeDiagnosticPort } from "./routes/diagnostics.ts";
export interface ApiComposition {readonly projections:UiProjectionPort;readonly intents:UiIntentDispatcher;readonly diagnostics:SafeDiagnosticPort;}
export function composeApi(ports:ApiComposition):ApiComposition{return Object.freeze({...ports});}
