export interface PurposeBinding { readonly purposeBindingId: string; readonly purposeIdentity: string; readonly purposeVersion: string; readonly packageIdentity: string; readonly packageVersion: string; readonly coreBindingRef: string; readonly hookBindingRef: string; }
export function assertExactPurposeBinding(actual: PurposeBinding, expected: PurposeBinding): PurposeBinding {
  for (const key of Object.keys(expected) as (keyof PurposeBinding)[]) if (actual[key] !== expected[key]) throw new Error(`PURPOSE_BINDING_MISMATCH:${key}`);
  return Object.freeze({ ...actual });
}
