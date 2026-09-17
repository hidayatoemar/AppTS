import type { IsoInstant } from "../contracts/ids.js";

export interface Clock { now(): IsoInstant }

export class ManualClock implements Clock {
  constructor(private current: Date) {}
  set(value: IsoInstant): void { this.current = new Date(value); }
  advance(ms: number): void { this.current = new Date(this.current.getTime() + ms); }
  now(): IsoInstant { return this.current.toISOString(); }
}
