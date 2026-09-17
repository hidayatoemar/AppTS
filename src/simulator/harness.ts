import type { ActionEffectPort } from "../adapters/action-effect-port.js";
import type { ActionCommandEnvelope } from "../contracts/ce-di.js";
import { firstSlicePolicy } from "../config/policy-config.js";
import { InMemoryStore } from "../persistence/in-memory-store.js";
import { executeCommand } from "../runtime/command-pipeline.js";
import type { ScopeSnapshot } from "../runtime/runtime-composition.js";
import { ManualClock } from "./clock.js";
import { DeterministicIdGenerator } from "./ids.js";

export class ScenarioHarness {
  readonly store = new InMemoryStore();
  readonly clock = new ManualClock(new Date("2026-09-17T12:00:00.000Z"));
  readonly ids = new DeterministicIdGenerator();

  constructor(private readonly executor: ActionEffectPort) {}

  load(snapshot: ScopeSnapshot): void { this.store.seed(snapshot); }

  run(command: ActionCommandEnvelope) {
    return executeCommand(command, {
      repository: this.store,
      policy: firstSlicePolicy,
      executor: this.executor,
      clock: this.clock,
      ids: this.ids,
      requiredAuthorityRefByAction: { "RS-A-022": "AUTH-RS-A022" },
    });
  }
}
