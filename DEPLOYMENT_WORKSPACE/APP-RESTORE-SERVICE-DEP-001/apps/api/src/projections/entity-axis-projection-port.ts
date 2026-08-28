import type { PersistencePool } from "@appts-restore-service/persistence";
import type { UiProjectionPort, UiReadContext } from "../routes/ui-read.ts";

type Row = Readonly<Record<string, unknown>>;
type Envelope = Readonly<Record<string, unknown>> & { readonly data?: unknown };

export type EntityActingCapacityStatus = "BOUND" | "UNBOUND" | "MISMATCH";
export interface EntityActingCapacity {
  readonly status: EntityActingCapacityStatus;
  readonly reason_ref: string;
  readonly entity_ref?: string;
  readonly holder_ref?: string;
  readonly role_instance_ref?: string;
  readonly assignment_ref?: string;
  readonly authority_basis_ref?: string;
}

function record(value: unknown): Row { return typeof value === "object" && value !== null ? value as Row : {}; }
function text(value: unknown): string | undefined { return typeof value === "string" && value.length > 0 ? value : undefined; }

export function resolveEntityActingCapacity(row: Row): EntityActingCapacity {
  const ticketEntity = text(row["ticket_entity_ref"]);
  const authorityEntity = text(row["authority_entity_ref"]);
  const holder = text(row["acting_holder_ref"]);
  const roleInstance = text(row["acting_role_instance_ref"]);
  const assignment = text(row["acting_assignment_ref"]);
  const basis = text(row["authority_basis_ref"]);
  const responsibilityEntity = text(row["responsibility_entity_ref"]);
  const responsibilityRole = text(row["responsibility_role_instance_ref"]);
  const responsibilityHolder = text(row["responsibility_holder_ref"]);
  const assignmentEntity = text(row["assignment_entity_ref"]);
  const assignmentRole = text(row["assignment_role_instance_ref"]);
  const assignmentHolder = text(row["assignment_holder_ref"]);
  const assignmentRef = text(row["assignment_ref"]);
  const assignmentBasis = text(row["assignment_authority_basis_ref"]);
  const required = [ticketEntity, authorityEntity, holder, roleInstance, assignment, basis, responsibilityEntity, responsibilityRole, responsibilityHolder, assignmentEntity, assignmentRole, assignmentHolder, assignmentRef, assignmentBasis];
  if (required.some((value) => value === undefined)) return Object.freeze({ status: "UNBOUND", reason_ref: "ENTITY_AUTHORITY_CONTEXT_REQUIRED" });
  const coherent = ticketEntity === authorityEntity && ticketEntity === responsibilityEntity && ticketEntity === assignmentEntity && holder === responsibilityHolder && holder === assignmentHolder && roleInstance === responsibilityRole && roleInstance === assignmentRole && assignment === assignmentRef && basis === assignmentBasis;
  if (!coherent) return Object.freeze({ status: "MISMATCH", reason_ref: "ENTITY_AUTHORITY_CONTEXT_MISMATCH" });
  return Object.freeze({ status: "BOUND", reason_ref: "ENTITY_AUTHORITY_CONTEXT_EXPLICIT", entity_ref: ticketEntity, holder_ref: holder, role_instance_ref: roleInstance, assignment_ref: assignment, authority_basis_ref: basis });
}

async function capacityRow(pool: PersistencePool, ticketId: string): Promise<Row> {
  const result = await pool.query<Row>(`SELECT rt.entity_ref AS ticket_entity_ref,
    ae.entity_ref AS authority_entity_ref,ae.acting_holder_ref,ae.acting_role_instance_ref,ae.acting_assignment_ref,ae.authority_basis_ref,
    ra.entity_ref AS responsibility_entity_ref,ra.role_instance_ref::text AS responsibility_role_instance_ref,ra.holder_ref::text AS responsibility_holder_ref,
    s.entity_ref AS assignment_entity_ref,s.role_instance_ref::text AS assignment_role_instance_ref,s.holder_ref::text AS assignment_holder_ref,s.assignment_ref::text AS assignment_ref,s.authority_basis_ref AS assignment_authority_basis_ref
    FROM appts.runtime_ticket rt
    LEFT JOIN appts.authority_projection ap ON ap.authority_projection_id=rt.current_authority_projection_id
    LEFT JOIN appts.authority_envelope ae ON ae.authority_result_id=ap.source_authority_result_id
    LEFT JOIN LATERAL (SELECT responsibility_id,entity_ref,role_instance_ref,holder_ref,assignment_snapshot_id FROM appts.responsible_assignment WHERE ticket_id=rt.ticket_id AND effective_to IS NULL ORDER BY effective_from DESC LIMIT 1) ra ON TRUE
    LEFT JOIN appts.assignment_snapshot s ON s.assignment_snapshot_id=ra.assignment_snapshot_id
    WHERE rt.ticket_id=$1::uuid`, [ticketId]);
  return result.rows[0] ?? Object.freeze({});
}

async function augmentTicketConsole(pool: PersistencePool, value: unknown, ticketId: string): Promise<unknown> {
  const envelope = record(value) as Envelope;
  const data = record(envelope.data);
  const row = await capacityRow(pool, ticketId);
  const capacity = resolveEntityActingCapacity(row);
  const actionBound = capacity.status === "BOUND";
  return Object.freeze({
    ...envelope,
    currentness_ref: actionBound ? envelope["currentness_ref"] : "MISSING_BINDING",
    data: Object.freeze({
      ...data,
      ticket_entity_ref: text(row["ticket_entity_ref"]) ?? null,
      acting_capacity_status: capacity.status,
      acting_capacity: capacity,
      entity_action_withholding_reason: actionBound ? null : capacity.reason_ref,
      ...(actionBound ? {} : { available_actions: Object.freeze([]), action_controls: Object.freeze([]), close_action_available: false }),
    }),
  });
}

async function augmentResponsibility(pool: PersistencePool, value: unknown, ticketId: string): Promise<unknown> {
  const envelope = record(value) as Envelope;
  const data = record(envelope.data);
  const current = record(data["current_responsibility"]);
  const row = await capacityRow(pool, ticketId);
  const capacity = resolveEntityActingCapacity(row);
  return Object.freeze({
    ...envelope,
    data: Object.freeze({
      ...data,
      current_responsibility: Object.freeze({
        ...current,
        entity_ref: text(row["responsibility_entity_ref"]) ?? text(row["assignment_entity_ref"]) ?? null,
        assignment_ref: text(row["assignment_ref"]) ?? null,
        authority_basis_ref: text(row["assignment_authority_basis_ref"]) ?? null,
        entity_binding_status: capacity.status,
      }),
    }),
  });
}

async function augmentWorkQueue(pool: PersistencePool, value: unknown): Promise<unknown> {
  const envelope = record(value) as Envelope;
  const data = record(envelope.data);
  const rawTickets = data["tickets"];
  if (!Array.isArray(rawTickets)) return value;
  const tickets = rawTickets.map(record);
  const ids = tickets.map((ticket) => text(ticket["ticket_id"])).filter((id): id is string => id !== undefined);
  if (ids.length === 0) return value;
  const result = await pool.query<Row>("SELECT ticket_id::text,entity_ref FROM appts.runtime_ticket WHERE ticket_id=ANY($1::uuid[])", [ids]);
  const entities = new Map(result.rows.map((row) => [text(row["ticket_id"]) ?? "", text(row["entity_ref"]) ?? null]));
  return Object.freeze({ ...envelope, data: Object.freeze({ ...data, tickets: Object.freeze(tickets.map((ticket) => { const id = text(ticket["ticket_id"]); return Object.freeze({ ...ticket, entity_ref: id ? entities.get(id) ?? null : null }); })) }) });
}

export function createEntityAxisProjectionPort(pool: PersistencePool, base: UiProjectionPort): UiProjectionPort {
  return Object.freeze({
    async read(viewId: string, subjectRef?: string, concern?: string, context?: UiReadContext): Promise<unknown> {
      const value = await base.read(viewId, subjectRef, concern, context);
      if (viewId === "UX-RS-01") return augmentWorkQueue(pool, value);
      if (viewId === "UX-RS-03" && subjectRef) return augmentTicketConsole(pool, value, subjectRef);
      if (viewId === "UX-RS-06" && subjectRef) return augmentResponsibility(pool, value, subjectRef);
      return value;
    },
  });
}
