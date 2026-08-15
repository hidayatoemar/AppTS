import type { ApiComposition } from "./composition.ts";
export const UI_API_PREFIX="/api/v1/ui" as const;
export function describeUiApi(composition:ApiComposition){return Object.freeze({prefix:UI_API_PREFIX,readOnlyRoutes:["work-queue","intake","tickets","incidents","control","executive","diagnostics"],mutatingRoutes:["intents","pending-captures"],composition});}
