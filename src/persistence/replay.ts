import type { ScopeRef } from "../contracts/ce-di.js";
import type { ScopeSnapshot } from "../runtime/runtime-composition.js";
import type { ScopeRepository } from "./ports.js";

export const replayScope = (repository: ScopeRepository, scopeRef: ScopeRef): Promise<ScopeSnapshot> => repository.replay(scopeRef);
