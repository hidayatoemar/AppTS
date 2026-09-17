import type { ActionEffectPort, GovernedExecutionOutcome } from "../adapters/action-effect-port.js";
import type { ActionCommandEnvelope } from "../contracts/ce-di.js";
import type { Ref } from "../contracts/ids.js";

export async function executeActionCommand(
  executor: ActionEffectPort,
  envelope: ActionCommandEnvelope,
  activeFunctionalBindings: readonly Ref[],
): Promise<GovernedExecutionOutcome> {
  return executor.execute(envelope, activeFunctionalBindings);
}
