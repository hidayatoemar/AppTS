export type TicketState = "ACCEPTED" | "ACTIVE" | "TERMINAL_PROCESSING" | "CLOSED";
export interface TicketRelation { readonly relationId: string; readonly fromTicketId: string; readonly toTicketId: string; readonly kind: "RELATED" | "DUPLICATE" | "SUCCESSOR" | "CORRECTION"; }
export interface TicketHistory { readonly ticketId: string; readonly state: TicketState; readonly relations: readonly TicketRelation[]; }
export function appendTicketRelation(history: TicketHistory, relation: TicketRelation): TicketHistory {
  if (relation.fromTicketId !== history.ticketId) throw new Error("RELATION_SOURCE_MISMATCH");
  return Object.freeze({ ...history, relations: Object.freeze([...history.relations, Object.freeze({ ...relation })]) });
}
export function transitionTicket(history: TicketHistory, next: TicketState): TicketHistory {
  if (history.state === "CLOSED" && next !== "CLOSED") throw new Error("CLOSED_TICKET_CANNOT_REOPEN");
  return Object.freeze({ ...history, state: next });
}
