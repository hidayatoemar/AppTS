export type AouaMode = "VALID" | "RENEWAL_DUE" | "GRACE" | "CONTINUITY_MODE" | "INVALID_OR_TAMPER_SUSPECTED";
export interface AouaEnvelope { readonly authorizationId: string; readonly issuerRef: string; readonly deploymentBinding: string; readonly validFrom: string; readonly expiresAt: string; readonly status: "ACTIVE" | "REVOKED"; readonly integrityValid: boolean; readonly securityProfileKnown: boolean; }
export interface AouaValidation { readonly mode: AouaMode; readonly criticalContinuityAllowed: boolean; readonly noncriticalExpansionAllowed: boolean; readonly reason: string; }
export function validateAoua(envelope: AouaEnvelope, deploymentBinding: string, trustedTime: string | undefined): AouaValidation {
  if (!envelope.integrityValid || !envelope.securityProfileKnown || envelope.status !== "ACTIVE" || envelope.deploymentBinding !== deploymentBinding || !trustedTime) return Object.freeze({ mode: "INVALID_OR_TAMPER_SUSPECTED", criticalContinuityAllowed: false, noncriticalExpansionAllowed: false, reason: "INTEGRITY_BINDING_STATUS_PROFILE_OR_TIME_INVALID" });
  if (trustedTime < envelope.validFrom) return Object.freeze({ mode: "INVALID_OR_TAMPER_SUSPECTED", criticalContinuityAllowed: false, noncriticalExpansionAllowed: false, reason: "NOT_YET_VALID" });
  if (trustedTime >= envelope.expiresAt) return Object.freeze({ mode: "CONTINUITY_MODE", criticalContinuityAllowed: true, noncriticalExpansionAllowed: false, reason: "EXPIRED_CRITICAL_CONTINUITY_ONLY" });
  return Object.freeze({ mode: "VALID", criticalContinuityAllowed: true, noncriticalExpansionAllowed: true, reason: "VALID" });
}
