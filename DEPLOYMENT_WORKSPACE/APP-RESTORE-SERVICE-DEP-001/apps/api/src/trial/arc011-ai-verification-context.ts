import { randomUUID } from "node:crypto";
import type { PersistencePool } from "@appts-restore-service/persistence";

export const ARC011_AI_VERIFICATION_CONTEXT = "ARC011_AI_VERIFICATION_NON_FACTUAL" as const;
export const ARC011_AI_VERIFICATION_MAPPING_PROFILE = "ARC011_EXTERNAL_DEPENDENCY_MAPPING_V1" as const;

export interface Arc011AiVerificationBindings {
  readonly ticketId: string;
  readonly responsibilityId: string;
  readonly sourceSystemRefId: string;
  readonly adapterProfileRefId: string;
  readonly externalSubjectRef: string;
  readonly blockedWorkRef: string;
  readonly supportingAssignmentRef: string;
  readonly escalationObligationRef: string;
  readonly escalationRouteRefCode: string;
  readonly disclosureLabelRef: string;
}

/**
 * MCR064 / ARC011 verification-only controlled bindings.
 * These values are synthetic, NON-PRODUCTION and NON-FACTUAL. The function may
 * establish source/profile configuration and a pre-existing D-02 escalation
 * context, but it never writes D-04 dependency/waiting/blocker truth.
 */
export async function establishArc011AiVerificationBindings(
  pool: PersistencePool,
  ticketId: string,
  disclosureLabelRef: string,
): Promise<Arc011AiVerificationBindings> {
  const responsibility = await pool.query<{ responsibility_id: string }>(
    "SELECT responsibility_id::text AS responsibility_id FROM appts.responsible_assignment WHERE ticket_id=$1 ORDER BY effective_from DESC LIMIT 1",
    [ticketId],
  );
  if (responsibility.rowCount !== 1) throw new Error("ARC011_VERIFICATION_RESPONSIBILITY_REQUIRED");

  const sourceSystemRefId = randomUUID();
  const adapterProfileRefId = randomUUID();
  const qualificationRulesRef = randomUUID();
  const externalSubjectRef = randomUUID();
  const blockedWorkRef = randomUUID();
  const supportingAssignmentRef = `ARC011-AI-VERIFY-SUPPORTING-ASSIGNMENT:${randomUUID()}`;
  const escalationObligationRef = randomUUID();
  const escalationRoleRef = randomUUID();
  const escalationRouteRefCode = "ARC011_AI_VERIFICATION_ESCALATION_ROUTE";
  const responsibilityId = responsibility.rows[0]!.responsibility_id;

  await pool.query(
    "INSERT INTO appts.authoritative_source_ref(source_system_ref_id,source_identity,source_version_or_profile_ref,authoritative_subject_class_ref,owner_ref,currentness_ref,effective_from) VALUES($1,$2,$3,$4,$5,'CURRENT',now())",
    [sourceSystemRefId, "ARC011_AI_VERIFICATION_EXTERNAL_WORLD", "ARC011_SYNTHETIC_V1", "EXTERNAL_DEPENDENCY", ARC011_AI_VERIFICATION_CONTEXT],
  );
  await pool.query(
    "INSERT INTO appts.adapter_profile_ref(adapter_profile_ref_id,source_system_ref_id,adapter_profile_identity,adapter_profile_version,qualification_rules_ref,effective_from) VALUES($1,$2,$3,1,$4,now())",
    [adapterProfileRefId, sourceSystemRefId, ARC011_AI_VERIFICATION_MAPPING_PROFILE, qualificationRulesRef],
  );

  const scope = Object.freeze({
    verification_context: ARC011_AI_VERIFICATION_CONTEXT,
    synthetic: true,
    non_production: true,
    non_factual: true,
    policy_default_claimed: false,
    purpose: "exercise accepted escalation behavior only",
  });
  await pool.query(
    `INSERT INTO appts.escalation_obligation_core(
      record_version,committed_at,disclosure_label_ref,escalation_id,ticket_id,responsibility_id,
      escalation_role_ref,intervention_scope_ref,intervention_scope_ref_schema_version,
      created_reason_ref,effective_from
    ) VALUES(0,now(),$1,$2,$3,$4,$5,$6::jsonb,$7,$8,now())`,
    [
      disclosureLabelRef,
      escalationObligationRef,
      ticketId,
      responsibilityId,
      escalationRoleRef,
      JSON.stringify(scope),
      "ARC011_AI_VERIFICATION_1.0",
      "ARC011_SYNTHETIC_TRIGGER_CONTEXT_ONLY",
    ],
  );

  return Object.freeze({
    ticketId,
    responsibilityId,
    sourceSystemRefId,
    adapterProfileRefId,
    externalSubjectRef,
    blockedWorkRef,
    supportingAssignmentRef,
    escalationObligationRef,
    escalationRouteRefCode,
    disclosureLabelRef,
  });
}
