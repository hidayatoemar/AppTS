export interface SourceRegistryEntry { readonly sourceSystemRefId: string; readonly status: "ACTIVE" | "UNAVAILABLE"; readonly currentnessRef: string; }
export interface AdapterProfile { readonly adapterProfileRefId: string; readonly sourceSystemRefId: string; readonly version: string; readonly status: "ACTIVE" | "UNSUPPORTED"; }
export type SourceResolution = { readonly status: "RESOLVED"; readonly source: SourceRegistryEntry; readonly profile: AdapterProfile } | { readonly status: "NO_EFFECT"; readonly reason: "SOURCE_UNAVAILABLE" | "PROFILE_UNSUPPORTED" | "PROFILE_SOURCE_MISMATCH" };
export function resolveSource(source: SourceRegistryEntry | undefined, profile: AdapterProfile | undefined): SourceResolution {
  if (!source || source.status !== "ACTIVE") return { status: "NO_EFFECT", reason: "SOURCE_UNAVAILABLE" };
  if (!profile || profile.status !== "ACTIVE") return { status: "NO_EFFECT", reason: "PROFILE_UNSUPPORTED" };
  return profile.sourceSystemRefId === source.sourceSystemRefId ? { status: "RESOLVED", source, profile } : { status: "NO_EFFECT", reason: "PROFILE_SOURCE_MISMATCH" };
}
