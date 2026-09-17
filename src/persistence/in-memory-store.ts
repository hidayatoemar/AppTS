import type { ActionCommandEnvelope, ScopeRef } from "../contracts/ce-di.js";
import type { AppendBatch, ScopeRepository, StoredCommandIdentity } from "./ports.js";
import type { ScopeSnapshot } from "../runtime/runtime-composition.js";
import { scopeKey } from "../runtime/runtime-composition.js";
import { applyAuthoritativeBatch, prepareScopeSnapshot } from "./replay.js";

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryStore implements ScopeRepository {
  private readonly scopes = new Map<string, { snapshot: ScopeSnapshot; batches: AppendBatch[] }>();
  private readonly commands = new Map<string, StoredCommandIdentity>();

  seed(snapshot: ScopeSnapshot): void {
    this.scopes.set(scopeKey(snapshot.scopeRef), { snapshot: prepareScopeSnapshot(snapshot), batches: [] });
  }

  mutateForTest(scopeRef: ScopeRef, mutate: (snapshot: ScopeSnapshot) => void): void {
    const entry = this.requireEntry(scopeRef);
    mutate(entry.snapshot);
  }

  async load(scopeRef: ScopeRef): Promise<ScopeSnapshot> {
    return clone(this.requireEntry(scopeRef).snapshot);
  }

  async append(expectedVersion: number, batch: AppendBatch): Promise<{ newVersion: number; commitId: string }> {
    const entry = this.requireEntry(batch.scopeRef);
    if (entry.snapshot.version !== expectedVersion) {
      throw new Error(`STALE_EXPECTED_VERSION:${expectedVersion}:actual=${entry.snapshot.version}`);
    }

    const nextVersion = expectedVersion + 1;
    entry.batches.push(clone(batch));
    applyAuthoritativeBatch(entry.snapshot, nextVersion, batch);

    if (batch.commandReplayIdentity) {
      this.commands.set(batch.commandReplayIdentity.commandId, clone(batch.commandReplayIdentity));
    }

    return { newVersion: nextVersion, commitId: batch.commitId };
  }

  async replay(scopeRef: ScopeRef): Promise<ScopeSnapshot> {
    return this.load(scopeRef);
  }

  async findCommand(commandId: string): Promise<StoredCommandIdentity | null> {
    return clone(this.commands.get(commandId) ?? null);
  }

  private requireEntry(scopeRef: ScopeRef) {
    const entry = this.scopes.get(scopeKey(scopeRef));
    if (!entry) throw new Error(`UNKNOWN_SCOPE:${scopeKey(scopeRef)}`);
    return entry;
  }
}

export const normalizeCommandEnvelope = (envelope: ActionCommandEnvelope): string => stableStringify(envelope);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
