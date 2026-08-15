export interface ExtensionRequest { readonly hookIdentity: string; readonly packageIdentity: string; readonly packageVersion: string; readonly input: Readonly<Record<string, unknown>>; }
export type ExtensionResult = { readonly status: "PROPOSAL"; readonly proposal: Readonly<Record<string, unknown>> } | { readonly status: "EXPLICIT_STUB_NO_EFFECT"; readonly reason: string };
export interface RegisteredHook { readonly hookIdentity: string; readonly packageIdentity: string; readonly packageVersion: string; invoke(input: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, unknown>>>; validate(result: Readonly<Record<string, unknown>>): boolean; }
export async function invokeBoundExtension(request: ExtensionRequest, hooks: readonly RegisteredHook[]): Promise<ExtensionResult> {
  const hook = hooks.find((item) => item.hookIdentity === request.hookIdentity && item.packageIdentity === request.packageIdentity && item.packageVersion === request.packageVersion);
  if (!hook) return { status: "EXPLICIT_STUB_NO_EFFECT", reason: "MISSING_OR_INCOMPATIBLE_BOUND_EXTENSION" };
  try { const proposal = await hook.invoke(request.input); return hook.validate(proposal) ? { status: "PROPOSAL", proposal: Object.freeze({ ...proposal }) } : { status: "EXPLICIT_STUB_NO_EFFECT", reason: "INVALID_EXTENSION_RESULT" }; }
  catch { return { status: "EXPLICIT_STUB_NO_EFFECT", reason: "EXTENSION_UNAVAILABLE_OR_FAILED" }; }
}
