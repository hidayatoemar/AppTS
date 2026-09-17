import type { IsoInstant, Ref } from "../contracts/ids.js";

export interface AuthenticatedIdentityInput {
  authenticatedPersonRef: Ref;
  authenticationEvidenceRefs: Ref[];
  receivedTime: IsoInstant;
}

export interface IdentityInputPort {
  currentIdentity(): Promise<AuthenticatedIdentityInput | null>;
}

export interface IdentityBoundaryObservation extends AuthenticatedIdentityInput {
  authorityCreated: false;
  actingContextCreated: false;
}

export const observeAuthenticatedIdentity = (
  input: AuthenticatedIdentityInput,
): IdentityBoundaryObservation => ({
  ...input,
  authorityCreated: false,
  actingContextCreated: false,
});
