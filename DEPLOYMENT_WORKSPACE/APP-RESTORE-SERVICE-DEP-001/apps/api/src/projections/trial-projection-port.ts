import type { PersistencePool } from "@appts-restore-service/persistence";
import type { UiProjectionPort } from "../routes/ui-read.ts";

interface RuntimeTicketRow {
  readonly ticket_id: string;
  readonly current_state_code: string;
  readonly aggregate_version: number | string;
  readonly current_context_version: number | string;
  readonly updated_at: Date | string;
  readonly currentness_ref: string | null;
}

interface PreTicketRow {
  readonly case_id: string;
  readonly projection_version: number | string;
  readonly currentness_ref: string;
  readonly rebuilt_at: Date | string;
  readonly case_status_ref: string;
  readonly overall_result_ref: string | null;
  readonly decision_code: string | null;
  readonly completeness_result: string | null;
  readonly completeness_reason: string | null;
}

function version(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function generatedAt(): string { return new Date().toISOString(); }

function aggregateCurrentness(values: readonly (string | null)[]): string {
  const actual = values.filter((value): value is string => typeof value === "string" && value.length > 0);
  if (actual.length === 0) return "CURRENT";
  const unique = new Set(actual);
  return unique.size === 1 ? actual[0]! : "MIXED_SOURCE";
}

async function readWorkQueue(pool: PersistencePool): Promise<unknown> {
  const result = await pool.query<RuntimeTicketRow>(`
    SELECT rt.ticket_id::text AS ticket_id,
           rt.current_state_code,
           rt.aggregate_version,
           rt.current_context_version,
           rt.updated_at,
           rc.currentness_ref
      FROM appts.runtime_ticket rt
      LEFT JOIN appts.runtime_context rc
        ON rc.ticket_id = rt.ticket_id
       AND rc.context_version = rt.current_context_version
     ORDER BY rt.updated_at DESC, rt.ticket_id
     LIMIT 100
  `);
  const tickets = result.rows.map((row) => Object.freeze({
    ticket_id: row.ticket_id,
    current_state_code: row.current_state_code,
    aggregate_version: version(row.aggregate_version),
    current_context_version: version(row.current_context_version),
    currentness_ref: row.currentness_ref ?? "MISSING_BINDING",
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }));
  const maxVersion = tickets.reduce((max, row) => Math.max(max, row.aggregate_version), 0);
  return Object.freeze({
    view_id: "UX-RS-01",
    source_version_set_ref: `runtime_ticket:${tickets.length}:${maxVersion}`,
    generated_at: generatedAt(),
    currentness_ref: aggregateCurrentness(tickets.map((row) => row.currentness_ref)),
    data: Object.freeze({ ticket_count: tickets.length, tickets: Object.freeze(tickets) }),
  });
}

async function readIntake(pool: PersistencePool, subjectRef?: string): Promise<unknown> {
  const parameters: readonly unknown[] = subjectRef === undefined ? [] : [subjectRef];
  const where = subjectRef === undefined ? "" : "WHERE c.case_id::text = $1";
  const result = await pool.query<PreTicketRow>(`
    SELECT c.case_id::text AS case_id,
           c.projection_version,
           c.currentness_ref,
           c.rebuilt_at,
           c.case_status_ref,
           a.overall_result_ref,
           d.decision_code,
           p.result_code AS completeness_result,
           p.reason_ref_code AS completeness_reason
      FROM appts.pre_ticket_case c
      LEFT JOIN appts.admission_assessment a ON a.assessment_id = c.current_assessment_id
      LEFT JOIN appts.intake_decision d ON d.decision_id = c.current_decision_id
      LEFT JOIN appts.admission_predicate_result p
        ON p.assessment_id = c.current_assessment_id
       AND p.predicate_identity = 'COMPLETENESS'
      ${where}
     ORDER BY c.rebuilt_at DESC, c.case_id
     LIMIT 100
  `, [...parameters]);
  const cases = result.rows.map((row) => Object.freeze({
    case_id: row.case_id,
    projection_version: version(row.projection_version),
    currentness_ref: row.currentness_ref,
    rebuilt_at: row.rebuilt_at instanceof Date ? row.rebuilt_at.toISOString() : String(row.rebuilt_at),
    case_status_ref: row.case_status_ref,
    assessment_result: row.overall_result_ref,
    decision_code: row.decision_code,
    completeness_result: row.completeness_result,
    completeness_reason: row.completeness_reason,
  }));
  const maxVersion = cases.reduce((max, row) => Math.max(max, row.projection_version), 0);
  return Object.freeze({
    view_id: "UX-RS-02",
    ...(subjectRef === undefined ? {} : { subject_ref: subjectRef }),
    source_version_set_ref: `pre_ticket_case:${cases.length}:${maxVersion}`,
    generated_at: generatedAt(),
    currentness_ref: aggregateCurrentness(cases.map((row) => row.currentness_ref)),
    data: Object.freeze({ case_count: cases.length, cases: Object.freeze(cases) }),
  });
}

export function createTrialProjectionPort(pool: PersistencePool): UiProjectionPort {
  return Object.freeze({
    async read(viewId: string, subjectRef?: string): Promise<unknown> {
      if (viewId === "UX-RS-01") return readWorkQueue(pool);
      if (viewId === "UX-RS-02") return readIntake(pool, subjectRef);
      throw new Error("UI_PROJECTION_NOT_AVAILABLE");
    },
  });
}
