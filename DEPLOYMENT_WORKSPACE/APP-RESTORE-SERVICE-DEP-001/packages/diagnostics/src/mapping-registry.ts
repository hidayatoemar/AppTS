import type { DiagnosticMappingEntry, DiagnosticRegistryVersion } from "@appts-restore-service/contracts";
export interface DiagnosticMappingRegistry { readonly version: DiagnosticRegistryVersion; readonly entries: readonly DiagnosticMappingEntry[]; readonly unexpectedMappingIdentity: string; }
export function resolveDiagnosticMapping(registry: DiagnosticMappingRegistry, failureIdentity: string): DiagnosticMappingEntry {
  if (registry.version.status_ref !== "ACTIVE") throw new Error("DIAGNOSTIC_REGISTRY_INACTIVE");
  const exact = registry.entries.find((item) => item.implementation_failure_identity === failureIdentity);
  const unexpected = registry.entries.find((item) => item.implementation_failure_identity === registry.unexpectedMappingIdentity);
  if (!exact && !unexpected) throw new Error("CONTROLLED_UNEXPECTED_MAPPING_MISSING");
  return Object.freeze({ ...(exact ?? unexpected!) });
}
