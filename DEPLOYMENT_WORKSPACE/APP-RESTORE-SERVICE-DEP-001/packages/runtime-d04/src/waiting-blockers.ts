export interface WaitingInterval { readonly waitingId: string; readonly ticketId: string; readonly reasonRef: string; readonly startedAt: string; readonly endedAt?: string; }
export interface RuntimeBlocker { readonly blockerId: string; readonly ticketId: string; readonly reasonRef: string; readonly status: "OPEN" | "RESOLVED"; }
export interface OrthogonalControlContext { readonly waiting: readonly WaitingInterval[]; readonly blockers: readonly RuntimeBlocker[]; }
export function addWaiting(context: OrthogonalControlContext, waiting: WaitingInterval): OrthogonalControlContext { return Object.freeze({ ...context, waiting: Object.freeze([...context.waiting, Object.freeze({ ...waiting })]) }); }
export function addBlocker(context: OrthogonalControlContext, blocker: RuntimeBlocker): OrthogonalControlContext { return Object.freeze({ ...context, blockers: Object.freeze([...context.blockers, Object.freeze({ ...blocker })]) }); }
