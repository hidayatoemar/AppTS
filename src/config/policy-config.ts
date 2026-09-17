import type { PolicyConfig } from "../contracts/policy.js";

export const firstSlicePolicy: PolicyConfig = {
  allowStaleActingContext: false,
  rsA022BindingsBySubjectType: {
    SERVICE: ["FB-SRV-15"],
    RESOURCE: ["FB-RES-23"],
    EXTERNAL_PARTNER: ["FB-BPT-11"],
  },
  gateByAction: { "RS-A-022": "READY" },
  enableByAction: { "RS-A-022": "ENABLED" },
};
