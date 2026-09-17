import { mkdir, readFile, writeFile, rename, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ScopeRef } from "../contracts/ce-di.js";
import type { Ref } from "../contracts/ids.js";
import type { ScopeSnapshot } from "../runtime/runtime-composition.js";
import { scopeKey } from "../runtime/runtime-composition.js";
import type { AppendBatch, ScopeRepository, StoredCommandIdentity } from "./ports.js";

const clone = <T>(value: T): T => structuredClone(value);

export interface JsonlCommittedRecord {
  streamIdentity: string;
  version: number;
  commitId: Ref;
  scopeRef: ScopeRef;
  batch: AppendBatch;
}

export interface JsonlRecoveryResult {
  records: JsonlCommittedRecord[];
  recoveredVersion: number;
  ignoredFinalTailFiles: string[];
}

export class LocalJsonlStore implements ScopeRepository {
  private readonly baselines = new Map<string, ScopeSnapshot>();
  private readonly locks = new Map<string, Promise<void>>();

  constructor(private readonly baseDir: string) {}

  seed(snapshot: ScopeSnapshot): void {
    if (snapshot.version !== 0) throw new Error("JSONL_BASELINE_VERSION_MUST_BE_ZERO");
    this.baselines.set(scopeKey(snapshot.scopeRef), clone(snapshot));
  }

  streamDirectory(scopeRef: ScopeRef): string {
    return join(this.baseDir, encodeURIComponent(scopeKey(scopeRef)));
  }

  async load(scopeRef: ScopeRef): Promise<ScopeSnapshot> {
    return this.replay(scopeRef);
  }

  async replay(scopeRef: ScopeRef): Promise<ScopeSnapshot> {
    const baseline = this.baselines.get(scopeKey(scopeRef));
    if (!baseline) throw new Error(`UNKNOWN_SCOPE:${scopeKey(scopeRef)}`);
    const snapshot = clone(baseline);
    const recovery = await this.recoverRecords(scopeRef);
    for (const record of recovery.records) this.applyBatch(snapshot, record.version, record.batch);
    return snapshot;
  }

  async append(expectedVersion: number, batch: AppendBatch): Promise<{ newVersion: number; commitId: Ref }> {
    return this.withStreamLock(batch.scopeRef, async () => {
      await this.ensureStreamDir(batch.scopeRef);
      let recovery = await this.recoverRecords(batch.scopeRef);
      for (const tailFile of recovery.ignoredFinalTailFiles) {
        await rename(tailFile, `${tailFile}.quarantine`);
      }
      if (recovery.ignoredFinalTailFiles.length > 0) recovery = await this.recoverRecords(batch.scopeRef);
      if (recovery.recoveredVersion !== expectedVersion) {
        throw new Error(`STALE_EXPECTED_VERSION:${expectedVersion}:actual=${recovery.recoveredVersion}`);
      }

      const nextVersion = expectedVersion + 1;
      const record: JsonlCommittedRecord = {
        streamIdentity: scopeKey(batch.scopeRef),
        version: nextVersion,
        commitId: batch.commitId,
        scopeRef: batch.scopeRef,
        batch: clone(batch),
      };
      const stem = `${String(nextVersion).padStart(10, "0")}-${sanitize(batch.commitId)}`;
      const partialPath = join(this.streamDirectory(batch.scopeRef), `${stem}.partial`);
      const committedPath = join(this.streamDirectory(batch.scopeRef), `${stem}.jsonl`);
      await writeFile(partialPath, `${JSON.stringify(record)}\n`, { encoding: "utf8", flag: "wx" });
      await rename(partialPath, committedPath);
      return { newVersion: nextVersion, commitId: batch.commitId };
    });
  }

  async findCommand(commandId: Ref): Promise<StoredCommandIdentity | null> {
    for (const baseline of this.baselines.values()) {
      const recovery = await this.recoverRecords(baseline.scopeRef);
      for (const record of recovery.records) {
        const batch = record.batch;
        if (batch.command?.commandId !== commandId || !batch.normalizedCommandIdentity || batch.executionRecords.length !== 1) continue;
        return {
          commandId,
          normalizedEnvelope: batch.normalizedCommandIdentity,
          execution: clone(batch.executionRecords[0]),
          effects: clone(batch.materialEffects),
        };
      }
    }
    return null;
  }

  async recoverRecords(scopeRef: ScopeRef): Promise<JsonlRecoveryResult> {
    const dir = this.streamDirectory(scopeRef);
    let names: string[];
    try {
      names = await readdir(dir);
    } catch (error) {
      if (isEnoent(error)) return { records: [], recoveredVersion: 0, ignoredFinalTailFiles: [] };
      throw error;
    }

    const committedNames = names.filter((name) => name.endsWith(".jsonl")).sort();
    const records: JsonlCommittedRecord[] = [];
    const ignoredFinalTailFiles: string[] = [];
    let expectedVersion = 1;

    for (let index = 0; index < committedNames.length; index += 1) {
      const name = committedNames[index];
      const path = join(dir, name);
      const isLast = index === committedNames.length - 1;
      let text: string;
      try {
        text = await readFile(path, "utf8");
      } catch (error) {
        throw new Error(`JSONL_READ_FAILURE:${name}:${String(error)}`);
      }

      if (!text.endsWith("\n")) {
        if (isLast) {
          ignoredFinalTailFiles.push(path);
          continue;
        }
        throw new Error(`JSONL_INTERIOR_CORRUPTION:${name}:unterminated`);
      }

      const body = text.slice(0, -1);
      if (body.includes("\n")) throw new Error(`JSONL_RECORD_FRAMING_VIOLATION:${name}`);
      let record: JsonlCommittedRecord;
      try {
        record = JSON.parse(body) as JsonlCommittedRecord;
      } catch {
        if (isLast) {
          ignoredFinalTailFiles.push(path);
          continue;
        }
        throw new Error(`JSONL_INTERIOR_CORRUPTION:${name}:malformed_json`);
      }

      if (record.streamIdentity !== scopeKey(scopeRef)) throw new Error(`JSONL_STREAM_IDENTITY_MISMATCH:${name}`);
      if (scopeKey(record.scopeRef) !== scopeKey(scopeRef) || scopeKey(record.batch.scopeRef) !== scopeKey(scopeRef)) {
        throw new Error(`JSONL_SCOPE_MISMATCH:${name}`);
      }
      if (record.commitId !== record.batch.commitId) throw new Error(`JSONL_COMMIT_ID_MISMATCH:${name}`);
      if (record.version !== expectedVersion) {
        throw new Error(`JSONL_VERSION_CORRUPTION:${name}:expected=${expectedVersion}:actual=${record.version}`);
      }
      records.push(record);
      expectedVersion += 1;
    }

    return { records, recoveredVersion: records.length, ignoredFinalTailFiles };
  }

  private applyBatch(snapshot: ScopeSnapshot, version: number, batch: AppendBatch): void {
    snapshot.version = version;
    for (const effect of batch.materialEffects) {
      if (effect.materialEffectEstablished) snapshot.truthRefs = [...effect.afterTruthRefs];
      snapshot.evidenceRefs.push(...effect.evidenceRefs);
    }
  }

  private async ensureStreamDir(scopeRef: ScopeRef): Promise<void> {
    await mkdir(this.streamDirectory(scopeRef), { recursive: true });
  }

  private async withStreamLock<T>(scopeRef: ScopeRef, operation: () => Promise<T>): Promise<T> {
    const key = scopeKey(scopeRef);
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => gate);
    this.locks.set(key, queued);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.locks.get(key) === queued) this.locks.delete(key);
    }
  }
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isEnoent(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}
