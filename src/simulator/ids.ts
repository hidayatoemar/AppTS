import type { Ref } from "../contracts/ids.js";

export interface IdGenerator { next(kind: string): Ref }

export class DeterministicIdGenerator implements IdGenerator {
  private n = 0;
  next(kind: string): Ref { this.n += 1; return `${kind}-${String(this.n).padStart(4, "0")}`; }
}
