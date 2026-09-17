import type {
  ActingContextResolution,
  GateEnableEvaluationRecord,
  LawfulActionProjection,
  ScopeRef,
} from "../contracts/ce-di.js";
import type { Ref } from "../contracts/ids.js";

export interface LawfulActionInput {
  scopeRef: ScopeRef;
  actionId: Ref;
  processEligible: boolean;
  authoritySatisfied: boolean;
  assignmentScopeSatisfied: boolean;
  currentnessSatisfied: boolean;
  integritySatisfied: boolean;
  dependenciesSatisfied: boolean;
  actingContext: ActingContextResolution | null;
  boundedMachineAuthorityRef?: Ref;
  gateEnable: GateEnableEvaluationRecord;
  dependencyRefs: Ref[];
}

export function projectLawfulAction(input: LawfulActionInput): LawfulActionProjection {
  const blocked: string[] = [];
  if (!input.processEligible) blocked.push("process_ineligible");
  if (!input.authoritySatisfied) blocked.push("authority_unsatisfied");
  if (!input.assignmentScopeSatisfied) blocked.push("assignment_scope_unsatisfied");
  if (!input.currentnessSatisfied) blocked.push("currentness_unsatisfied");
  if (!input.integritySatisfied) blocked.push("integrity_unsatisfied");
  if (!input.dependenciesSatisfied) blocked.push("dependency_unsatisfied");
  if (input.gateEnable.gateReadiness !== "READY") blocked.push("gate_not_ready");

  const humanContextReady = input.actingContext?.kind === "EXACT_ONE";
  const machineReady = Boolean(input.boundedMachineAuthorityRef);
  if (!humanContextReady && !machineReady) blocked.push("no_lawful_context_or_machine_authority");
  if (input.actingContext?.kind === "AMBIGUOUS") blocked.push("acting_context_ambiguous");

  if (humanContextReady && input.gateEnable.enableState !== "ENABLED") blocked.push("human_enable_not_enabled");
  if (machineReady && input.gateEnable.enableState !== "NOT_REQUIRED") blocked.push("machine_enable_not_not_required");

  return {
    scopeRef: input.scopeRef,
    actionId: input.actionId,
    available: blocked.length === 0,
    blockedReasons: blocked,
    requiredContextRefs:
      input.actingContext?.kind === "EXACT_ONE" ? [input.actingContext.candidate.contextRef] : [],
    requiredDependencyRefs: input.dependencyRefs,
    gateEnableRef: `${input.actionId}@${input.gateEnable.inputVersion}`,
  };
}
