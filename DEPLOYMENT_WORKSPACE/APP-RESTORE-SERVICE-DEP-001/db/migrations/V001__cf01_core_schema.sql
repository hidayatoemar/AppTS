-- CF06-B01 / CODEX-EXEC-003
-- PostgreSQL 17 native SQL; CF-01 v0.2.2 rev4 authority.
SET TIME ZONE 'UTC';
DO $$ BEGIN
  IF current_setting('server_version_num')::integer / 10000 <> 17 THEN RAISE EXCEPTION 'CF06-B01 requires PostgreSQL major 17'; END IF;
  IF getdatabaseencoding() <> 'UTF8' THEN RAISE EXCEPTION 'CF06-B01 requires UTF8 database encoding'; END IF;
END $$;
CREATE SCHEMA appts;
CREATE SCHEMA appts_sys;
CREATE TABLE appts_sys.schema_migration (
 migration_id text COLLATE "C" PRIMARY KEY,
 checksum bytea NOT NULL,
 artifact_version text COLLATE "C" NOT NULL,
 engine_major smallint NOT NULL CONSTRAINT ck_schema_migration__engine_major CHECK (engine_major = 17),
 applied_at timestamptz(3) NOT NULL
);
CREATE FUNCTION appts.reject_canonical_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only table % rejects %', TG_TABLE_NAME, TG_OP; END $$;
SET search_path = appts, pg_catalog;
CREATE TABLE appts.ticket_identity (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  ticket_id uuid DEFAULT gen_random_uuid() NOT NULL,
  formation_id uuid NOT NULL,
  purpose_binding_id uuid NOT NULL,
  primary_domain_id uuid NOT NULL,
  formed_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_ticket_identity PRIMARY KEY (ticket_id)
);

CREATE TABLE appts.intake_cue (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  cue_id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_ref_id uuid NOT NULL,
  received_at timestamptz(3) NOT NULL,
  subject_ref_id uuid,
  subject_ref_json jsonb,
  subject_ref_json_schema_version text COLLATE "C",
  channel_ref_id uuid,
  channel_ref_code text COLLATE "C",
  correlation_id uuid,
  CONSTRAINT pk_intake_cue PRIMARY KEY (cue_id),
  CONSTRAINT ck_intake_cue__subject_ref_branch CHECK (num_nonnulls(subject_ref_id, subject_ref_json) <= 1),
  CONSTRAINT ck_intake_cue__subject_ref_json_version CHECK ((subject_ref_json IS NULL) = (subject_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_intake_cue__channel_ref_branch CHECK (num_nonnulls(channel_ref_id, channel_ref_code) <= 1),
  CONSTRAINT ck_intake_cue__subject_ref_json_schema CHECK ((subject_ref_json IS NULL) = (subject_ref_json_schema_version IS NULL))
);

CREATE TABLE appts.source_observation (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  observation_id uuid DEFAULT gen_random_uuid() NOT NULL,
  cue_id uuid,
  source_content_ref_kind text COLLATE "C" NOT NULL,
  source_content_ref_uri text,
  source_content_ref_text text,
  source_content_ref_json jsonb,
  source_content_ref_json_schema_version text COLLATE "C",
  subject_ref uuid NOT NULL,
  channel_ref text COLLATE "C",
  source_time timestamptz(3),
  provenance_ref uuid NOT NULL,
  qualification_ref uuid,
  content_digest bytea,
  CONSTRAINT pk_source_observation PRIMARY KEY (observation_id),
  CONSTRAINT ck_source_observation__source_content_ref_branch CHECK (((source_content_ref_kind = 'URI' AND source_content_ref_uri IS NOT NULL) OR (source_content_ref_kind = 'TEXT' AND source_content_ref_text IS NOT NULL) OR (source_content_ref_kind = 'JSON' AND source_content_ref_json IS NOT NULL AND source_content_ref_json_schema_version IS NOT NULL))),
  CONSTRAINT ck_source_observation__source_content_ref_json_schema CHECK ((source_content_ref_json IS NULL) = (source_content_ref_json_schema_version IS NULL))
);

CREATE TABLE appts.pre_ticket_case (
  projection_version bigint NOT NULL CHECK (projection_version >= 0),
  currentness_ref text COLLATE "C" NOT NULL,
  rebuilt_at timestamptz(3) NOT NULL,
  case_id uuid DEFAULT gen_random_uuid() NOT NULL,
  governing_observation_ref uuid NOT NULL,
  current_assessment_id uuid,
  current_decision_id uuid,
  deficiency_set_version bigint,
  case_status_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_pre_ticket_case PRIMARY KEY (case_id),
  CONSTRAINT ck_pre_ticket_case__deficiency_set_version_nonnegative CHECK (deficiency_set_version >= 0)
);

CREATE TABLE appts.admission_assessment (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  assessment_id uuid DEFAULT gen_random_uuid() NOT NULL,
  case_id uuid NOT NULL,
  assessed_against_case_version bigint NOT NULL,
  overall_result_ref text COLLATE "C" NOT NULL,
  evaluated_at timestamptz(3) NOT NULL,
  successor_assessment_id uuid,
  CONSTRAINT pk_admission_assessment PRIMARY KEY (assessment_id),
  CONSTRAINT ck_admission_assessment__assessed_against_case_version_nonnegative CHECK (assessed_against_case_version >= 0)
);

CREATE TABLE appts.admission_predicate_result (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  predicate_result_id uuid DEFAULT gen_random_uuid() NOT NULL,
  assessment_id uuid NOT NULL,
  predicate_identity text COLLATE "C" NOT NULL,
  result_code text COLLATE "C" NOT NULL,
  reason_ref_id uuid,
  reason_ref_code text COLLATE "C",
  evidence_ref uuid,
  source_version_ref_id uuid,
  CONSTRAINT pk_admission_predicate_result PRIMARY KEY (predicate_result_id),
  CONSTRAINT ck_admission_predicate_result__reason_ref_branch CHECK (num_nonnulls(reason_ref_id, reason_ref_code) <= 1)
);

CREATE TABLE appts.intake_decision (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  decision_id uuid DEFAULT gen_random_uuid() NOT NULL,
  case_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  decision_code text COLLATE "C" NOT NULL,
  reason_ref text COLLATE "C",
  deficiency_set_ref jsonb,
  deficiency_set_ref_schema_version text COLLATE "C",
  governing_ticket_id uuid,
  decided_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_intake_decision PRIMARY KEY (decision_id),
  CONSTRAINT ck_intake_decision__deficiency_set_ref_schema CHECK ((deficiency_set_ref IS NULL) = (deficiency_set_ref_schema_version IS NULL))
);

CREATE TABLE appts.ticket_formation_record (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  formation_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  intake_decision_id uuid NOT NULL,
  purpose_binding_id uuid NOT NULL,
  responsible_assignment_ref uuid NOT NULL,
  formation_evidence_set_ref uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  producer_aggregate_version bigint NOT NULL,
  activation_record_ref uuid NOT NULL,
  commit_marker_id uuid NOT NULL,
  CONSTRAINT pk_ticket_formation_record PRIMARY KEY (formation_id),
  CONSTRAINT ck_ticket_formation_record__producer_aggregate_version_nonnegative CHECK (producer_aggregate_version >= 0)
);

CREATE TABLE appts.incident_record (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  incident_id uuid DEFAULT gen_random_uuid() NOT NULL,
  incident_version bigint NOT NULL,
  incident_subject_ref_id uuid,
  incident_subject_ref_json jsonb,
  incident_subject_ref_json_schema_version text COLLATE "C",
  cause_classification_ref_id uuid,
  cause_classification_ref_code text COLLATE "C",
  CONSTRAINT pk_incident_record PRIMARY KEY (incident_id),
  CONSTRAINT ck_incident_record__incident_subject_ref_branch CHECK (num_nonnulls(incident_subject_ref_id, incident_subject_ref_json) <= 1),
  CONSTRAINT ck_incident_record__incident_subject_ref_json_version CHECK ((incident_subject_ref_json IS NULL) = (incident_subject_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_incident_record__cause_classification_ref_branch CHECK (num_nonnulls(cause_classification_ref_id, cause_classification_ref_code) <= 1),
  CONSTRAINT ck_incident_record__incident_subject_ref_json_schema CHECK ((incident_subject_ref_json IS NULL) = (incident_subject_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_incident_record__incident_version_nonnegative CHECK (incident_version >= 0)
);

CREATE TABLE appts.relationship_record (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  relationship_id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_subject_type text COLLATE "C" NOT NULL,
  source_subject_id uuid NOT NULL,
  target_subject_type text COLLATE "C" NOT NULL,
  target_subject_id uuid NOT NULL,
  relationship_type text COLLATE "C" NOT NULL,
  direction_code text COLLATE "C" NOT NULL,
  authority_ref uuid,
  reason_ref text COLLATE "C",
  provenance_ref uuid,
  evidence_ref uuid,
  CONSTRAINT pk_relationship_record PRIMARY KEY (relationship_id)
);

CREATE TABLE appts.post_closure_correction (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  correction_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  corrected_record_type text COLLATE "C" NOT NULL,
  corrected_record_id uuid NOT NULL,
  correction_reason_ref text COLLATE "C" NOT NULL,
  corrected_value_ref_id uuid,
  corrected_value_ref_json jsonb,
  corrected_value_ref_json_schema_version text COLLATE "C",
  evidence_ref uuid NOT NULL,
  impact_assessment_ref uuid,
  CONSTRAINT pk_post_closure_correction PRIMARY KEY (correction_id),
  CONSTRAINT ck_post_closure_correction__corrected_value_ref_branch CHECK (num_nonnulls(corrected_value_ref_id, corrected_value_ref_json) <= 1),
  CONSTRAINT ck_post_closure_correction__corrected_value_ref_json_version CHECK ((corrected_value_ref_json IS NULL) = (corrected_value_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_post_closure_correction__corrected_value_ref_json_schema CHECK ((corrected_value_ref_json IS NULL) = (corrected_value_ref_json_schema_version IS NULL))
);

CREATE TABLE appts.successor_ticket_link (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  successor_link_id uuid DEFAULT gen_random_uuid() NOT NULL,
  predecessor_ticket_id uuid NOT NULL,
  successor_ticket_id uuid NOT NULL,
  reason_ref text COLLATE "C" NOT NULL,
  authorized_by_ref uuid NOT NULL,
  effective_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_successor_ticket_link PRIMARY KEY (successor_link_id)
);

CREATE TABLE appts.purpose_extension_binding (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  binding_id uuid DEFAULT gen_random_uuid() NOT NULL,
  purpose_identity text COLLATE "C" NOT NULL,
  purpose_version text COLLATE "C" NOT NULL,
  package_identity text COLLATE "C" NOT NULL,
  package_version text COLLATE "C" NOT NULL,
  ticket_core_version text COLLATE "C" NOT NULL,
  hook_contract_version text COLLATE "C" NOT NULL,
  capability_declaration_ref_id uuid,
  capability_declaration_ref_json jsonb,
  capability_declaration_ref_json_schema_version text COLLATE "C",
  extension_namespace text COLLATE "C" NOT NULL,
  authorization_basis_ref uuid NOT NULL,
  compatibility_declaration_id uuid NOT NULL,
  accepted_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_purpose_extension_binding PRIMARY KEY (binding_id),
  CONSTRAINT ck_purpose_extension_binding__capability_declaration_ref_branch CHECK (num_nonnulls(capability_declaration_ref_id, capability_declaration_ref_json) = 1),
  CONSTRAINT ck_purpose_extension_binding__capability_declaration_ref_json_version CHECK ((capability_declaration_ref_json IS NULL) = (capability_declaration_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_purpose_extension_binding__capability_declaration_ref_json_schema CHECK ((capability_declaration_ref_json IS NULL) = (capability_declaration_ref_json_schema_version IS NULL))
);

CREATE TABLE appts.assignment_snapshot (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  assignment_snapshot_id uuid DEFAULT gen_random_uuid() NOT NULL,
  role_type_ref uuid NOT NULL,
  role_instance_ref uuid NOT NULL,
  holder_ref uuid NOT NULL,
  assignment_ref uuid NOT NULL,
  source_version_ref_id uuid NOT NULL,
  scope_ref_id uuid,
  scope_ref_json jsonb,
  scope_ref_json_schema_version text COLLATE "C",
  domain_id uuid NOT NULL,
  eligible_from timestamptz(3),
  eligible_to timestamptz(3),
  qualification_ref uuid NOT NULL,
  retrieved_at timestamptz(3) NOT NULL,
  verified_at timestamptz(3),
  CONSTRAINT pk_assignment_snapshot PRIMARY KEY (assignment_snapshot_id),
  CONSTRAINT ck_assignment_snapshot__scope_ref_branch CHECK (num_nonnulls(scope_ref_id, scope_ref_json) = 1),
  CONSTRAINT ck_assignment_snapshot__scope_ref_json_version CHECK ((scope_ref_json IS NULL) = (scope_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_assignment_snapshot__scope_ref_json_schema CHECK ((scope_ref_json IS NULL) = (scope_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_assignment_snapshot__eligible_from_eligible_to CHECK (eligible_to IS NULL OR eligible_to >= eligible_from)
);

CREATE TABLE appts.authority_envelope (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  authority_result_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  context_ref_id uuid,
  context_ref_json jsonb,
  context_ref_json_schema_version text COLLATE "C",
  assignment_snapshot_set_ref uuid NOT NULL,
  responsibility_id uuid,
  effective_from timestamptz(3) NOT NULL,
  effective_to timestamptz(3),
  result_status_ref text COLLATE "C" NOT NULL,
  currentness_ref_id uuid,
  currentness_ref_code text COLLATE "C",
  sod_decision_ref uuid,
  refresh_lineage_ref uuid,
  CONSTRAINT pk_authority_envelope PRIMARY KEY (authority_result_id),
  CONSTRAINT ck_authority_envelope__context_ref_branch CHECK (num_nonnulls(context_ref_id, context_ref_json) = 1),
  CONSTRAINT ck_authority_envelope__context_ref_json_version CHECK ((context_ref_json IS NULL) = (context_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_authority_envelope__currentness_ref_branch CHECK (num_nonnulls(currentness_ref_id, currentness_ref_code) = 1),
  CONSTRAINT ck_authority_envelope__context_ref_json_schema CHECK ((context_ref_json IS NULL) = (context_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_authority_envelope__effective_from_effective_to CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE appts.authority_action (
  authority_action_id uuid DEFAULT gen_random_uuid() NOT NULL,
  authority_result_id uuid NOT NULL,
  action_class_ref text COLLATE "C" NOT NULL,
  permission_code text COLLATE "C" NOT NULL,
  restriction_reason_ref text COLLATE "C",
  CONSTRAINT pk_authority_action PRIMARY KEY (authority_action_id)
);

CREATE TABLE appts.responsible_assignment (
  record_version bigint CHECK (record_version >= 0),
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  responsibility_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  domain_id uuid NOT NULL,
  role_instance_ref uuid NOT NULL,
  holder_ref uuid,
  assignment_snapshot_id uuid NOT NULL,
  effective_from timestamptz(3) NOT NULL,
  effective_to timestamptz(3),
  predecessor_responsibility_id uuid,
  handover_response_id uuid,
  status_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_responsible_assignment PRIMARY KEY (responsibility_id),
  CONSTRAINT ck_responsible_assignment__effective_from_effective_to CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE appts.handover_proposal (
  record_version bigint CHECK (record_version >= 0),
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  handover_proposal_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  domain_id uuid NOT NULL,
  current_responsibility_id uuid NOT NULL,
  proposed_receiver_assignment_ref uuid NOT NULL,
  transfer_scope_ref_id uuid,
  transfer_scope_ref_json jsonb,
  transfer_scope_ref_json_schema_version text COLLATE "C",
  open_obligation_snapshot_ref uuid NOT NULL,
  evidence_snapshot_ref uuid,
  proposer_authority_ref uuid NOT NULL,
  proposed_effective_at timestamptz(3),
  CONSTRAINT pk_handover_proposal PRIMARY KEY (handover_proposal_id),
  CONSTRAINT ck_handover_proposal__transfer_scope_ref_branch CHECK (num_nonnulls(transfer_scope_ref_id, transfer_scope_ref_json) = 1),
  CONSTRAINT ck_handover_proposal__transfer_scope_ref_json_version CHECK ((transfer_scope_ref_json IS NULL) = (transfer_scope_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_handover_proposal__transfer_scope_ref_json_schema CHECK ((transfer_scope_ref_json IS NULL) = (transfer_scope_ref_json_schema_version IS NULL))
);

CREATE TABLE appts.handover_response (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  handover_response_id uuid DEFAULT gen_random_uuid() NOT NULL,
  handover_proposal_id uuid NOT NULL,
  receiver_assignment_ref uuid NOT NULL,
  receiver_authority_ref uuid NOT NULL,
  response_code text COLLATE "C" NOT NULL,
  response_reason_ref text COLLATE "C",
  responded_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_handover_response PRIMARY KEY (handover_response_id)
);

CREATE TABLE appts.responsibility_change (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  responsibility_change_id uuid DEFAULT gen_random_uuid() NOT NULL,
  handover_proposal_id uuid NOT NULL,
  handover_response_id uuid NOT NULL,
  prior_responsibility_id uuid NOT NULL,
  successor_responsibility_id uuid NOT NULL,
  expected_prior_version bigint NOT NULL,
  effective_at timestamptz(3) NOT NULL,
  commit_marker_id uuid NOT NULL,
  CONSTRAINT pk_responsibility_change PRIMARY KEY (responsibility_change_id),
  CONSTRAINT ck_responsibility_change__expected_prior_version_nonnegative CHECK (expected_prior_version >= 0)
);

CREATE TABLE appts.delegation_grant (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  delegation_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  accountability_responsibility_id uuid NOT NULL,
  delegator_authority_ref uuid NOT NULL,
  delegate_assignment_ref uuid NOT NULL,
  action_scope_ref_id uuid,
  action_scope_ref_json jsonb,
  action_scope_ref_json_schema_version text COLLATE "C",
  effective_from timestamptz(3) NOT NULL,
  effective_to timestamptz(3),
  revocation_ref uuid,
  CONSTRAINT pk_delegation_grant PRIMARY KEY (delegation_id),
  CONSTRAINT ck_delegation_grant__action_scope_ref_branch CHECK (num_nonnulls(action_scope_ref_id, action_scope_ref_json) = 1),
  CONSTRAINT ck_delegation_grant__action_scope_ref_json_version CHECK ((action_scope_ref_json IS NULL) = (action_scope_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_delegation_grant__action_scope_ref_json_schema CHECK ((action_scope_ref_json IS NULL) = (action_scope_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_delegation_grant__effective_from_effective_to CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE appts.escalation_obligation_core (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  escalation_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  responsibility_id uuid NOT NULL,
  escalation_role_ref uuid NOT NULL,
  intervention_scope_ref jsonb NOT NULL,
  intervention_scope_ref_schema_version text COLLATE "C" NOT NULL,
  created_reason_ref text COLLATE "C" NOT NULL,
  effective_from timestamptz(3) NOT NULL,
  acknowledgment_ref uuid,
  intervention_result_ref text COLLATE "C",
  successor_escalation_id uuid,
  CONSTRAINT pk_escalation_obligation_core PRIMARY KEY (escalation_id),
  CONSTRAINT ck_escalation_obligation_core__intervention_scope_ref_schema CHECK ((intervention_scope_ref IS NULL) = (intervention_scope_ref_schema_version IS NULL))
);

CREATE TABLE appts.sod_decision (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  sod_decision_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid,
  protected_class_ref text COLLATE "C" NOT NULL,
  principal_or_holder_ref uuid NOT NULL,
  compared_role_or_action_refs_id uuid,
  compared_role_or_action_refs_json jsonb,
  compared_role_or_action_refs_json_schema_version text COLLATE "C",
  result_code text COLLATE "C" NOT NULL,
  reason_ref text COLLATE "C",
  evaluated_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_sod_decision PRIMARY KEY (sod_decision_id),
  CONSTRAINT ck_sod_decision__compared_role_or_action_refs_branch CHECK (num_nonnulls(compared_role_or_action_refs_id, compared_role_or_action_refs_json) = 1),
  CONSTRAINT ck_sod_decision__compared_role_or_action_refs_json_version CHECK ((compared_role_or_action_refs_json IS NULL) = (compared_role_or_action_refs_json_schema_version IS NULL)),
  CONSTRAINT ck_sod_decision__compared_role_or_action_refs_json_schema CHECK ((compared_role_or_action_refs_json IS NULL) = (compared_role_or_action_refs_json_schema_version IS NULL))
);

CREATE TABLE appts.authority_refresh (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  refresh_id uuid DEFAULT gen_random_uuid() NOT NULL,
  prior_authority_result_id uuid NOT NULL,
  request_context_ref jsonb NOT NULL,
  request_context_ref_schema_version text COLLATE "C" NOT NULL,
  request_time timestamptz(3) NOT NULL,
  result_authority_id uuid,
  no_valid_result_ref text COLLATE "C",
  currentness_basis_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_authority_refresh PRIMARY KEY (refresh_id),
  CONSTRAINT ck_authority_refresh__request_context_ref_schema CHECK ((request_context_ref IS NULL) = (request_context_ref_schema_version IS NULL))
);

CREATE TABLE appts.evidence_object (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  evidence_id uuid DEFAULT gen_random_uuid() NOT NULL,
  subject_type text COLLATE "C" NOT NULL,
  subject_id uuid NOT NULL,
  evidence_type_ref text COLLATE "C" NOT NULL,
  source_context_ref jsonb NOT NULL,
  source_context_ref_schema_version text COLLATE "C" NOT NULL,
  collector_role_or_holder_ref uuid,
  content_ref_kind text COLLATE "C" NOT NULL,
  content_ref_id uuid,
  content_ref_uri text,
  content_ref_text text,
  content_ref_json jsonb,
  content_ref_json_schema_version text COLLATE "C",
  integrity_envelope_id uuid,
  availability_ref text COLLATE "C",
  retention_obligation_ref uuid NOT NULL,
  CONSTRAINT pk_evidence_object PRIMARY KEY (evidence_id),
  CONSTRAINT ck_evidence_object__content_ref_branch CHECK (((content_ref_kind = 'ID' AND content_ref_id IS NOT NULL) OR (content_ref_kind = 'URI' AND content_ref_uri IS NOT NULL) OR (content_ref_kind = 'TEXT' AND content_ref_text IS NOT NULL) OR (content_ref_kind = 'JSON' AND content_ref_json IS NOT NULL AND content_ref_json_schema_version IS NOT NULL))),
  CONSTRAINT ck_evidence_object__source_context_ref_schema CHECK ((source_context_ref IS NULL) = (source_context_ref_schema_version IS NULL)),
  CONSTRAINT ck_evidence_object__content_ref_json_schema CHECK ((content_ref_json IS NULL) = (content_ref_json_schema_version IS NULL))
);

CREATE TABLE appts.evidence_qualification (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  qualification_id uuid DEFAULT gen_random_uuid() NOT NULL,
  evidence_id uuid NOT NULL,
  quality_ref text COLLATE "C" NOT NULL,
  currentness_ref_id uuid,
  currentness_ref_code text COLLATE "C",
  scope_ref_id uuid,
  scope_ref_json jsonb,
  scope_ref_json_schema_version text COLLATE "C",
  assessed_by_ref uuid,
  assessed_at timestamptz(3) NOT NULL,
  predecessor_qualification_id uuid,
  CONSTRAINT pk_evidence_qualification PRIMARY KEY (qualification_id),
  CONSTRAINT ck_evidence_qualification__currentness_ref_branch CHECK (num_nonnulls(currentness_ref_id, currentness_ref_code) = 1),
  CONSTRAINT ck_evidence_qualification__scope_ref_branch CHECK (num_nonnulls(scope_ref_id, scope_ref_json) = 1),
  CONSTRAINT ck_evidence_qualification__scope_ref_json_version CHECK ((scope_ref_json IS NULL) = (scope_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_evidence_qualification__scope_ref_json_schema CHECK ((scope_ref_json IS NULL) = (scope_ref_json_schema_version IS NULL))
);

CREATE TABLE appts.evidence_correction (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  evidence_correction_id uuid DEFAULT gen_random_uuid() NOT NULL,
  original_evidence_id uuid NOT NULL,
  correction_type_ref text COLLATE "C" NOT NULL,
  successor_evidence_or_interpretation_ref uuid NOT NULL,
  reason_ref text COLLATE "C" NOT NULL,
  authority_ref uuid NOT NULL,
  evidence_ref uuid,
  CONSTRAINT pk_evidence_correction PRIMARY KEY (evidence_correction_id)
);

CREATE TABLE appts.claim_record (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  claim_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  claim_type_ref text COLLATE "C" NOT NULL,
  subject_ref uuid NOT NULL,
  claim_value_ref_id uuid,
  claim_value_ref_code text COLLATE "C",
  claim_value_ref_json jsonb,
  claim_value_ref_json_schema_version text COLLATE "C",
  claimant_ref uuid,
  claim_authority_ref uuid,
  claim_time timestamptz(3) NOT NULL,
  validity_scope_ref jsonb,
  validity_scope_ref_schema_version text COLLATE "C",
  CONSTRAINT pk_claim_record PRIMARY KEY (claim_id),
  CONSTRAINT ck_claim_record__claim_value_ref_branch CHECK (num_nonnulls(claim_value_ref_id, claim_value_ref_code, claim_value_ref_json) = 1),
  CONSTRAINT ck_claim_record__claim_value_ref_json_version CHECK ((claim_value_ref_json IS NULL) = (claim_value_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_claim_record__claim_value_ref_json_schema CHECK ((claim_value_ref_json IS NULL) = (claim_value_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_claim_record__validity_scope_ref_schema CHECK ((validity_scope_ref IS NULL) = (validity_scope_ref_schema_version IS NULL))
);

CREATE TABLE appts.interpretation_record (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  interpretation_id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_claim_or_evidence_ref uuid NOT NULL,
  interpretation_type_ref text COLLATE "C" NOT NULL,
  interpreted_value_ref_id uuid,
  interpreted_value_ref_json jsonb,
  interpreted_value_ref_json_schema_version text COLLATE "C",
  authority_ref uuid,
  reason_ref text COLLATE "C",
  CONSTRAINT pk_interpretation_record PRIMARY KEY (interpretation_id),
  CONSTRAINT ck_interpretation_record__interpreted_value_ref_branch CHECK (num_nonnulls(interpreted_value_ref_id, interpreted_value_ref_json) = 1),
  CONSTRAINT ck_interpretation_record__interpreted_value_ref_json_version CHECK ((interpreted_value_ref_json IS NULL) = (interpreted_value_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_interpretation_record__interpreted_value_ref_json_schema CHECK ((interpreted_value_ref_json IS NULL) = (interpreted_value_ref_json_schema_version IS NULL))
);

CREATE TABLE appts.claim_evidence_link (
  claim_evidence_link_id uuid DEFAULT gen_random_uuid() NOT NULL,
  claim_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  relation_type_ref text COLLATE "C" NOT NULL,
  scope_ref jsonb,
  scope_ref_schema_version text COLLATE "C",
  linked_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_claim_evidence_link PRIMARY KEY (claim_evidence_link_id),
  CONSTRAINT ck_claim_evidence_link__scope_ref_schema CHECK ((scope_ref IS NULL) = (scope_ref_schema_version IS NULL))
);

CREATE TABLE appts.contradiction_set (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  contradiction_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  subject_ref uuid NOT NULL,
  contradiction_type_ref text COLLATE "C" NOT NULL,
  resolution_status_ref text COLLATE "C" NOT NULL,
  resolution_ref uuid,
  CONSTRAINT pk_contradiction_set PRIMARY KEY (contradiction_id)
);

CREATE TABLE appts.contradiction_member (
  contradiction_member_id uuid DEFAULT gen_random_uuid() NOT NULL,
  contradiction_id uuid NOT NULL,
  member_type text COLLATE "C" NOT NULL,
  member_id uuid NOT NULL,
  member_version_ref text COLLATE "C",
  CONSTRAINT pk_contradiction_member PRIMARY KEY (contradiction_member_id)
);

CREATE TABLE appts.evidence_set_version (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  evidence_set_version_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  scope_ref jsonb NOT NULL,
  scope_ref_schema_version text COLLATE "C" NOT NULL,
  set_version bigint NOT NULL,
  created_for_ref_id uuid,
  created_for_ref_code text COLLATE "C",
  predecessor_set_version_id uuid,
  CONSTRAINT pk_evidence_set_version PRIMARY KEY (evidence_set_version_id),
  CONSTRAINT ck_evidence_set_version__created_for_ref_branch CHECK (num_nonnulls(created_for_ref_id, created_for_ref_code) = 1),
  CONSTRAINT ck_evidence_set_version__scope_ref_schema CHECK ((scope_ref IS NULL) = (scope_ref_schema_version IS NULL)),
  CONSTRAINT ck_evidence_set_version__set_version_nonnegative CHECK (set_version >= 0)
);

CREATE TABLE appts.evidence_set_member (
  evidence_set_member_id uuid DEFAULT gen_random_uuid() NOT NULL,
  evidence_set_version_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  qualification_id uuid,
  member_role_ref text COLLATE "C",
  CONSTRAINT pk_evidence_set_member PRIMARY KEY (evidence_set_member_id)
);

CREATE TABLE appts.verification_request (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  verification_request_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  scope_ref jsonb NOT NULL,
  scope_ref_schema_version text COLLATE "C" NOT NULL,
  evidence_set_version_id uuid NOT NULL,
  required_independence_ref text COLLATE "C" NOT NULL,
  requested_verifier_role_ref uuid,
  requested_at timestamptz(3) NOT NULL,
  method_ref text COLLATE "C",
  CONSTRAINT pk_verification_request PRIMARY KEY (verification_request_id),
  CONSTRAINT ck_verification_request__scope_ref_schema CHECK ((scope_ref IS NULL) = (scope_ref_schema_version IS NULL))
);

CREATE TABLE appts.verifier_eligibility_decision (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  eligibility_decision_id uuid DEFAULT gen_random_uuid() NOT NULL,
  verification_request_id uuid NOT NULL,
  verifier_ref uuid NOT NULL,
  authority_result_ref uuid NOT NULL,
  sod_decision_id uuid,
  result_code text COLLATE "C" NOT NULL,
  reason_ref text COLLATE "C",
  evaluated_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_verifier_eligibility_decision PRIMARY KEY (eligibility_decision_id)
);

CREATE TABLE appts.verification_result (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  verification_result_id uuid DEFAULT gen_random_uuid() NOT NULL,
  verification_request_id uuid NOT NULL,
  evidence_set_version_id uuid NOT NULL,
  verifier_ref uuid NOT NULL,
  eligibility_decision_id uuid NOT NULL,
  result_code text COLLATE "C" NOT NULL,
  reason_ref text COLLATE "C",
  validity_scope_ref jsonb NOT NULL,
  validity_scope_ref_schema_version text COLLATE "C" NOT NULL,
  currentness_ref text COLLATE "C" NOT NULL,
  completed_at timestamptz(3) NOT NULL,
  predecessor_result_id uuid,
  CONSTRAINT pk_verification_result PRIMARY KEY (verification_result_id),
  CONSTRAINT ck_verification_result__validity_scope_ref_schema CHECK ((validity_scope_ref IS NULL) = (validity_scope_ref_schema_version IS NULL))
);

CREATE TABLE appts.gate_evaluation (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  gate_evaluation_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  gate_identity text COLLATE "C" NOT NULL,
  input_version_set_ref_id uuid,
  input_version_set_ref_json jsonb,
  input_version_set_ref_json_schema_version text COLLATE "C",
  evidence_set_version_id uuid,
  authority_result_ref uuid,
  verification_result_ref uuid,
  communication_status_ref text COLLATE "C",
  blocker_dependency_status_ref text COLLATE "C",
  policy_binding_ref uuid,
  overall_result_ref text COLLATE "C" NOT NULL,
  evaluated_at timestamptz(3) NOT NULL,
  predecessor_gate_evaluation_id uuid,
  CONSTRAINT pk_gate_evaluation PRIMARY KEY (gate_evaluation_id),
  CONSTRAINT ck_gate_evaluation__input_version_set_ref_branch CHECK (num_nonnulls(input_version_set_ref_id, input_version_set_ref_json) = 1),
  CONSTRAINT ck_gate_evaluation__input_version_set_ref_json_version CHECK ((input_version_set_ref_json IS NULL) = (input_version_set_ref_json_schema_version IS NULL)),
  CONSTRAINT ck_gate_evaluation__input_version_set_ref_json_schema CHECK ((input_version_set_ref_json IS NULL) = (input_version_set_ref_json_schema_version IS NULL))
);

CREATE TABLE appts.gate_predicate_result (
  gate_predicate_result_id uuid DEFAULT gen_random_uuid() NOT NULL,
  gate_evaluation_id uuid NOT NULL,
  predicate_identity text COLLATE "C" NOT NULL,
  result_code text COLLATE "C" NOT NULL,
  reason_ref text COLLATE "C",
  input_record_ref uuid,
  CONSTRAINT pk_gate_predicate_result PRIMARY KEY (gate_predicate_result_id)
);

CREATE TABLE appts.progression_envelope (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  envelope_id uuid DEFAULT gen_random_uuid() NOT NULL,
  gate_evaluation_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  effective_from timestamptz(3) NOT NULL,
  effective_to timestamptz(3),
  currentness_ref text COLLATE "C" NOT NULL,
  predecessor_envelope_id uuid,
  CONSTRAINT pk_progression_envelope PRIMARY KEY (envelope_id),
  CONSTRAINT ck_progression_envelope__effective_from_effective_to CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE appts.progression_class (
  progression_class_id uuid DEFAULT gen_random_uuid() NOT NULL,
  envelope_id uuid NOT NULL,
  progression_class_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_progression_class PRIMARY KEY (progression_class_id)
);

CREATE TABLE appts.terminal_disposition_assessment (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  disposition_assessment_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  disposition_qualifier_ref_id uuid,
  disposition_qualifier_ref_code text COLLATE "C",
  disposition_authority_ref text COLLATE "C" NOT NULL,
  restoration_claim_ref uuid,
  evidence_set_version_id uuid NOT NULL,
  verification_result_ref uuid,
  communication_disposition_ref text COLLATE "C",
  residual_obligation_set_ref jsonb,
  residual_obligation_set_ref_schema_version text COLLATE "C",
  successor_requirement_ref uuid,
  overall_result_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_terminal_disposition_assessment PRIMARY KEY (disposition_assessment_id),
  CONSTRAINT ck_terminal_disposition_assessment__disposition_qualifier_ref_branch CHECK (num_nonnulls(disposition_qualifier_ref_id, disposition_qualifier_ref_code) = 1),
  CONSTRAINT ck_terminal_disposition_assessment__residual_obligation_set_ref_schema CHECK ((residual_obligation_set_ref IS NULL) = (residual_obligation_set_ref_schema_version IS NULL))
);

CREATE TABLE appts.closure_readiness_assessment (
  record_version bigint CHECK (record_version >= 0),
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
  source_version_ref_id uuid,
  observed_at timestamptz(3),
  received_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  actor_ref uuid,
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  closure_assessment_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  disposition_assessment_id uuid NOT NULL,
  evidence_sufficiency_ref uuid NOT NULL,
  verification_completion_ref uuid NOT NULL,
  communication_completion_or_na_ref uuid NOT NULL,
  blocker_dependency_disposition_ref text COLLATE "C" NOT NULL,
  residual_obligation_disposition_ref text COLLATE "C" NOT NULL,
  successor_link_ref uuid,
  closure_authority_ref uuid NOT NULL,
  result_code text COLLATE "C" NOT NULL,
  assessed_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_closure_readiness_assessment PRIMARY KEY (closure_assessment_id)
);

CREATE TABLE appts.source_ref (
  source_ref_id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_identity text COLLATE "C" NOT NULL,
  source_owner_ref text COLLATE "C" NOT NULL,
  source_class_ref text COLLATE "C" NOT NULL,
  authoritative_scope_ref jsonb NOT NULL,
  authoritative_scope_ref_schema_version text COLLATE "C" NOT NULL,
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  CONSTRAINT pk_source_ref PRIMARY KEY (source_ref_id),
  CONSTRAINT ck_source_ref__authoritative_scope_ref_schema CHECK ((authoritative_scope_ref IS NULL) = (authoritative_scope_ref_schema_version IS NULL)),
  CONSTRAINT ck_source_ref__effective_from_effective_to CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE appts.source_version_ref (
  source_version_ref_id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_ref_id uuid NOT NULL,
  source_version_identity text COLLATE "C" NOT NULL,
  retrieved_at timestamptz(3),
  effective_from timestamptz(3),
  effective_to timestamptz(3),
  currentness_ref text COLLATE "C" NOT NULL,
  integrity_envelope_id uuid,
  CONSTRAINT pk_source_version_ref PRIMARY KEY (source_version_ref_id),
  CONSTRAINT ck_source_version_ref__effective_from_effective_to CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE appts.policy_binding_ref (
  policy_binding_ref_id uuid DEFAULT gen_random_uuid() NOT NULL,
  policy_identity text COLLATE "C" NOT NULL,
  policy_version bigint NOT NULL,
  owner_ref text COLLATE "C" NOT NULL,
  applicability_ref jsonb NOT NULL,
  applicability_ref_schema_version text COLLATE "C" NOT NULL,
  effective_from timestamptz(3) NOT NULL,
  effective_to timestamptz(3),
  source_ref_id uuid NOT NULL,
  currentness_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_policy_binding_ref PRIMARY KEY (policy_binding_ref_id),
  CONSTRAINT ck_policy_binding_ref__applicability_ref_schema CHECK ((applicability_ref IS NULL) = (applicability_ref_schema_version IS NULL)),
  CONSTRAINT ck_policy_binding_ref__policy_version_nonnegative CHECK (policy_version >= 0),
  CONSTRAINT ck_policy_binding_ref__effective_from_effective_to CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE appts.configuration_snapshot (
  configuration_snapshot_id uuid DEFAULT gen_random_uuid() NOT NULL,
  configuration_source_ref uuid NOT NULL,
  configuration_version_ref text COLLATE "C" NOT NULL,
  scope_ref jsonb NOT NULL,
  scope_ref_schema_version text COLLATE "C" NOT NULL,
  captured_at timestamptz(3) NOT NULL,
  qualification_ref uuid NOT NULL,
  payload_or_reference_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  CONSTRAINT pk_configuration_snapshot PRIMARY KEY (configuration_snapshot_id),
  CONSTRAINT ck_configuration_snapshot__scope_ref_schema CHECK ((scope_ref IS NULL) = (scope_ref_schema_version IS NULL))
);

CREATE TABLE appts.missing_binding_result (
  missing_binding_result_id uuid DEFAULT gen_random_uuid() NOT NULL,
  subject_ref uuid NOT NULL,
  required_binding_class_ref text COLLATE "C" NOT NULL,
  owner_ref text COLLATE "C" NOT NULL,
  reason_ref text COLLATE "C" NOT NULL,
  latest_safe_gate_ref uuid,
  detected_at timestamptz(3) NOT NULL,
  resolved_by_ref uuid,
  CONSTRAINT pk_missing_binding_result PRIMARY KEY (missing_binding_result_id)
);

CREATE TABLE appts.integrity_envelope (
  integrity_envelope_id uuid DEFAULT gen_random_uuid() NOT NULL,
  digest_value bytea NOT NULL,
  algorithm_ref text COLLATE "C" NOT NULL,
  key_or_trust_ref_id uuid,
  key_or_trust_ref_code text COLLATE "C",
  verification_status_ref text COLLATE "C" NOT NULL,
  verified_at timestamptz(3),
  signature_or_proof_ref_kind text COLLATE "C",
  signature_or_proof_ref_uri text,
  signature_or_proof_ref_json jsonb,
  signature_or_proof_ref_json_schema_version text COLLATE "C",
  CONSTRAINT pk_integrity_envelope PRIMARY KEY (integrity_envelope_id),
  CONSTRAINT ck_integrity_envelope__key_or_trust_ref_branch CHECK (num_nonnulls(key_or_trust_ref_id, key_or_trust_ref_code) <= 1),
  CONSTRAINT ck_integrity_envelope__signature_or_proof_ref_branch CHECK (((signature_or_proof_ref_kind = 'URI' AND signature_or_proof_ref_uri IS NOT NULL) OR (signature_or_proof_ref_kind = 'JSON' AND signature_or_proof_ref_json IS NOT NULL AND signature_or_proof_ref_json_schema_version IS NOT NULL)) OR (signature_or_proof_ref_kind IS NULL AND num_nonnulls(signature_or_proof_ref_uri, signature_or_proof_ref_json) = 0)),
  CONSTRAINT ck_integrity_envelope__signature_or_proof_ref_json_schema CHECK ((signature_or_proof_ref_json IS NULL) = (signature_or_proof_ref_json_schema_version IS NULL))
);

CREATE TABLE appts.lineage_edge (
  lineage_edge_id uuid DEFAULT gen_random_uuid() NOT NULL,
  predecessor_type text COLLATE "C" NOT NULL,
  predecessor_id uuid NOT NULL,
  successor_type text COLLATE "C" NOT NULL,
  successor_id uuid NOT NULL,
  edge_type_ref text COLLATE "C" NOT NULL,
  reason_ref text COLLATE "C",
  effective_at timestamptz(3) NOT NULL,
  authority_ref uuid,
  CONSTRAINT pk_lineage_edge PRIMARY KEY (lineage_edge_id)
);

CREATE TABLE appts.idempotency_ledger (
  idempotency_ledger_id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_domain_ref text COLLATE "C" NOT NULL,
  idempotency_key uuid NOT NULL,
  command_or_message_identity text COLLATE "C" NOT NULL,
  payload_hash text COLLATE "C" NOT NULL,
  durable_result_ref text COLLATE "C",
  first_seen_at timestamptz(3) NOT NULL,
  last_seen_at timestamptz(3) NOT NULL,
  conflict_status_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_idempotency_ledger PRIMARY KEY (idempotency_ledger_id)
);

CREATE TABLE appts.inbox_entry (
  entry_id uuid DEFAULT gen_random_uuid() NOT NULL,
  interface_identity text COLLATE "C" NOT NULL,
  semantic_version text COLLATE "C" NOT NULL,
  profile_identity text COLLATE "C" NOT NULL,
  access_set_identity text COLLATE "C",
  message_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  correlation_id uuid NOT NULL,
  causation_id uuid,
  producer_ref_id uuid,
  producer_ref_code text COLLATE "C",
  subject_ref uuid NOT NULL,
  source_sequence_or_version text COLLATE "C",
  produced_at timestamptz(3) NOT NULL,
  received_at timestamptz(3),
  payload_hash bytea NOT NULL,
  integrity_envelope_id uuid,
  durable_result_ref uuid,
  state_code text COLLATE "C" NOT NULL,
  accepted_at timestamptz(3),
  validation_result_ref text COLLATE "C" NOT NULL,
  currentness_result_ref text COLLATE "C",
  processing_result_ref uuid,
  consumer_cursor_ref text COLLATE "C",
  CONSTRAINT pk_inbox_entry PRIMARY KEY (entry_id)
);

CREATE TABLE appts.outbox_entry (
  entry_id uuid DEFAULT gen_random_uuid() NOT NULL,
  interface_identity text COLLATE "C" NOT NULL,
  semantic_version text COLLATE "C" NOT NULL,
  profile_identity text COLLATE "C" NOT NULL,
  access_set_identity text COLLATE "C",
  message_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  correlation_id uuid NOT NULL,
  causation_id uuid,
  producer_ref_id uuid,
  producer_ref_code text COLLATE "C",
  subject_ref uuid NOT NULL,
  source_sequence_or_version text COLLATE "C",
  produced_at timestamptz(3) NOT NULL,
  received_at timestamptz(3),
  payload_hash bytea NOT NULL,
  integrity_envelope_id uuid,
  durable_result_ref uuid,
  state_code text COLLATE "C" NOT NULL,
  producer_commit_marker_id uuid NOT NULL,
  publication_status_ref text COLLATE "C" NOT NULL,
  next_attempt_at timestamptz(3),
  published_at timestamptz(3),
  acknowledgment_ref uuid,
  CONSTRAINT pk_outbox_entry PRIMARY KEY (entry_id)
);

CREATE TABLE appts.commit_marker (
  commit_marker_id uuid DEFAULT gen_random_uuid() NOT NULL,
  owner_domain_ref text COLLATE "C" NOT NULL,
  aggregate_or_subject_ref uuid NOT NULL,
  expected_version bigint,
  resulting_version bigint,
  transaction_identity text COLLATE "C" NOT NULL,
  committed_at timestamptz(3) NOT NULL,
  result_hash text COLLATE "C",
  CONSTRAINT pk_commit_marker PRIMARY KEY (commit_marker_id),
  CONSTRAINT ck_commit_marker__expected_version_nonnegative CHECK (expected_version >= 0),
  CONSTRAINT ck_commit_marker__resulting_version_nonnegative CHECK (resulting_version >= 0)
);

CREATE TABLE appts.audit_event (
  audit_event_id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_identity text COLLATE "C" NOT NULL,
  ticket_id uuid,
  domain_id uuid,
  subject_type text COLLATE "C" NOT NULL,
  subject_id uuid NOT NULL,
  actor_ref uuid,
  actor_role_or_assignment_ref uuid,
  authority_ref uuid,
  command_id uuid,
  message_id uuid,
  correlation_id uuid NOT NULL,
  causation_id uuid,
  before_version_ref text COLLATE "C",
  after_version_ref text COLLATE "C",
  effect_disposition_ref text COLLATE "C",
  reason_ref text COLLATE "C",
  source_ref_id uuid,
  evidence_ref uuid,
  occurred_at timestamptz(3) NOT NULL,
  committed_at timestamptz(3) NOT NULL,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  CONSTRAINT pk_audit_event PRIMARY KEY (audit_event_id)
);

CREATE TABLE appts.access_audit (
  access_audit_id uuid DEFAULT gen_random_uuid() NOT NULL,
  principal_ref uuid NOT NULL,
  authority_ref uuid,
  ticket_or_subject_ref uuid NOT NULL,
  field_or_field_class_ref text COLLATE "C" NOT NULL,
  access_type_ref text COLLATE "C" NOT NULL,
  purpose_ref uuid NOT NULL,
  result_code text COLLATE "C" NOT NULL,
  reason_ref text COLLATE "C",
  accessed_at timestamptz(3) NOT NULL,
  audit_event_id uuid NOT NULL,
  CONSTRAINT pk_access_audit PRIMARY KEY (access_audit_id)
);

CREATE TABLE appts.export_manifest (
  export_manifest_id uuid DEFAULT gen_random_uuid() NOT NULL,
  export_job_id uuid,
  authorized_scope_ref jsonb NOT NULL,
  authorized_scope_ref_schema_version text COLLATE "C" NOT NULL,
  population_definition_ref jsonb NOT NULL,
  population_definition_ref_schema_version text COLLATE "C" NOT NULL,
  created_at timestamptz(3) NOT NULL,
  expected_record_count bigint NOT NULL,
  actual_record_count bigint,
  manifest_hash text COLLATE "C",
  status_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_export_manifest PRIMARY KEY (export_manifest_id),
  CONSTRAINT ck_export_manifest__authorized_scope_ref_schema CHECK ((authorized_scope_ref IS NULL) = (authorized_scope_ref_schema_version IS NULL)),
  CONSTRAINT ck_export_manifest__population_definition_ref_schema CHECK ((population_definition_ref IS NULL) = (population_definition_ref_schema_version IS NULL)),
  CONSTRAINT ck_export_manifest__expected_record_count_nonnegative CHECK (expected_record_count >= 0),
  CONSTRAINT ck_export_manifest__actual_record_count_nonnegative CHECK (actual_record_count >= 0)
);

CREATE TABLE appts.export_manifest_item (
  export_manifest_item_id uuid DEFAULT gen_random_uuid() NOT NULL,
  export_manifest_id uuid NOT NULL,
  source_record_type text COLLATE "C" NOT NULL,
  source_record_id uuid NOT NULL,
  source_record_version_ref text COLLATE "C",
  item_hash text COLLATE "C",
  included_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_export_manifest_item PRIMARY KEY (export_manifest_item_id)
);

CREATE TABLE appts.release_identity (
  release_identity_id uuid DEFAULT gen_random_uuid() NOT NULL,
  release_class_ref text COLLATE "C" NOT NULL,
  identity text COLLATE "C" NOT NULL,
  version text COLLATE "C" NOT NULL,
  effective_from timestamptz(3) NOT NULL,
  effective_to timestamptz(3),
  status_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_release_identity PRIMARY KEY (release_identity_id),
  CONSTRAINT ck_release_identity__effective_from_effective_to CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE appts.compatibility_declaration (
  compatibility_declaration_id uuid DEFAULT gen_random_uuid() NOT NULL,
  predecessor_release_ref uuid,
  successor_release_ref uuid NOT NULL,
  compatibility_class_ref text COLLATE "C" NOT NULL,
  profile_or_access_impact_ref jsonb,
  profile_or_access_impact_ref_schema_version text COLLATE "C",
  declared_at timestamptz(3) NOT NULL,
  authority_ref uuid NOT NULL,
  CONSTRAINT pk_compatibility_declaration PRIMARY KEY (compatibility_declaration_id),
  CONSTRAINT ck_compatibility_declaration__profile_or_access_impact_ref_schema CHECK ((profile_or_access_impact_ref IS NULL) = (profile_or_access_impact_ref_schema_version IS NULL))
);
ALTER TABLE appts.ticket_identity ADD CONSTRAINT uq_ticket_identity__formation UNIQUE (formation_id);
ALTER TABLE appts.ticket_formation_record ADD CONSTRAINT uq_ticket_formation_record__ticket UNIQUE (ticket_id);
ALTER TABLE appts.ticket_formation_record ADD CONSTRAINT uq_ticket_formation_record__idempotency UNIQUE (idempotency_key);
ALTER TABLE appts.responsibility_change ADD CONSTRAINT uq_responsibility_change__proposal UNIQUE (handover_proposal_id);
ALTER TABLE appts.progression_envelope ADD CONSTRAINT uq_progression_envelope__gate UNIQUE (gate_evaluation_id);
ALTER TABLE appts.source_version_ref ADD CONSTRAINT uq_source_version_ref__source_version UNIQUE (source_ref_id, source_version_identity);
ALTER TABLE appts.idempotency_ledger ADD CONSTRAINT uq_idempotency_ledger__owner_key UNIQUE (owner_domain_ref, idempotency_key);
ALTER TABLE appts.release_identity ADD CONSTRAINT uq_release_identity__identity_version UNIQUE (release_class_ref, identity, version);
ALTER TABLE appts.successor_ticket_link ADD CONSTRAINT ck_successor_ticket_link__different_tickets CHECK (predecessor_ticket_id <> successor_ticket_id);
ALTER TABLE appts.source_version_ref ADD CONSTRAINT fk_source_version_ref__source_ref_id__source_ref FOREIGN KEY (source_ref_id) REFERENCES appts.source_ref (source_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.policy_binding_ref ADD CONSTRAINT fk_policy_binding_ref__source_ref_id__source_ref FOREIGN KEY (source_ref_id) REFERENCES appts.source_ref (source_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.configuration_snapshot ADD CONSTRAINT fk_configuration_snapshot__integrity_envelope_id__integrity_envelope FOREIGN KEY (integrity_envelope_id) REFERENCES appts.integrity_envelope (integrity_envelope_id) ON DELETE RESTRICT;
ALTER TABLE appts.ticket_identity ADD CONSTRAINT fk_ticket_identity__formation_id__ticket_formation_record FOREIGN KEY (formation_id) REFERENCES appts.ticket_formation_record (formation_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE appts.ticket_identity ADD CONSTRAINT fk_ticket_identity__purpose_binding_id__purpose_extension_binding FOREIGN KEY (purpose_binding_id) REFERENCES appts.purpose_extension_binding (binding_id) ON DELETE RESTRICT;
ALTER TABLE appts.intake_cue ADD CONSTRAINT fk_intake_cue__source_ref_id__source_ref FOREIGN KEY (source_ref_id) REFERENCES appts.source_ref (source_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.source_observation ADD CONSTRAINT fk_source_observation__cue_id__intake_cue FOREIGN KEY (cue_id) REFERENCES appts.intake_cue (cue_id) ON DELETE RESTRICT;
ALTER TABLE appts.pre_ticket_case ADD CONSTRAINT fk_pre_ticket_case__current_assessment_id__admission_assessment FOREIGN KEY (current_assessment_id) REFERENCES appts.admission_assessment (assessment_id) ON DELETE RESTRICT;
ALTER TABLE appts.pre_ticket_case ADD CONSTRAINT fk_pre_ticket_case__current_decision_id__intake_decision FOREIGN KEY (current_decision_id) REFERENCES appts.intake_decision (decision_id) ON DELETE RESTRICT;
ALTER TABLE appts.admission_assessment ADD CONSTRAINT fk_admission_assessment__case_id__pre_ticket_case FOREIGN KEY (case_id) REFERENCES appts.pre_ticket_case (case_id) ON DELETE RESTRICT;
ALTER TABLE appts.admission_assessment ADD CONSTRAINT fk_admission_assessment__successor_assessment_id__admission_assessment FOREIGN KEY (successor_assessment_id) REFERENCES appts.admission_assessment (assessment_id) ON DELETE RESTRICT;
ALTER TABLE appts.admission_predicate_result ADD CONSTRAINT fk_admission_predicate_result__assessment_id__admission_assessment FOREIGN KEY (assessment_id) REFERENCES appts.admission_assessment (assessment_id) ON DELETE RESTRICT;
ALTER TABLE appts.admission_predicate_result ADD CONSTRAINT fk_admission_predicate_result__evidence_ref__evidence_object FOREIGN KEY (evidence_ref) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.admission_predicate_result ADD CONSTRAINT fk_admission_predicate_result__source_version_ref_id__source_version_ref FOREIGN KEY (source_version_ref_id) REFERENCES appts.source_version_ref (source_version_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.intake_decision ADD CONSTRAINT fk_intake_decision__case_id__pre_ticket_case FOREIGN KEY (case_id) REFERENCES appts.pre_ticket_case (case_id) ON DELETE RESTRICT;
ALTER TABLE appts.intake_decision ADD CONSTRAINT fk_intake_decision__assessment_id__admission_assessment FOREIGN KEY (assessment_id) REFERENCES appts.admission_assessment (assessment_id) ON DELETE RESTRICT;
ALTER TABLE appts.intake_decision ADD CONSTRAINT fk_intake_decision__governing_ticket_id__ticket_identity FOREIGN KEY (governing_ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.ticket_formation_record ADD CONSTRAINT fk_ticket_formation_record__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE appts.ticket_formation_record ADD CONSTRAINT fk_ticket_formation_record__intake_decision_id__intake_decision FOREIGN KEY (intake_decision_id) REFERENCES appts.intake_decision (decision_id) ON DELETE RESTRICT;
ALTER TABLE appts.ticket_formation_record ADD CONSTRAINT fk_ticket_formation_record__purpose_binding_id__purpose_extension_binding FOREIGN KEY (purpose_binding_id) REFERENCES appts.purpose_extension_binding (binding_id) ON DELETE RESTRICT;
ALTER TABLE appts.ticket_formation_record ADD CONSTRAINT fk_ticket_formation_record__responsible_assignment_ref__responsible_assignment FOREIGN KEY (responsible_assignment_ref) REFERENCES appts.responsible_assignment (responsibility_id) ON DELETE RESTRICT;
ALTER TABLE appts.ticket_formation_record ADD CONSTRAINT fk_ticket_formation_record__formation_evidence_set_ref__evidence_set_version FOREIGN KEY (formation_evidence_set_ref) REFERENCES appts.evidence_set_version (evidence_set_version_id) ON DELETE RESTRICT;
ALTER TABLE appts.ticket_formation_record ADD CONSTRAINT fk_ticket_formation_record__commit_marker_id__commit_marker FOREIGN KEY (commit_marker_id) REFERENCES appts.commit_marker (commit_marker_id) ON DELETE RESTRICT;
ALTER TABLE appts.post_closure_correction ADD CONSTRAINT fk_post_closure_correction__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.post_closure_correction ADD CONSTRAINT fk_post_closure_correction__evidence_ref__evidence_object FOREIGN KEY (evidence_ref) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.successor_ticket_link ADD CONSTRAINT fk_successor_ticket_link__predecessor_ticket_id__ticket_identity FOREIGN KEY (predecessor_ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.successor_ticket_link ADD CONSTRAINT fk_successor_ticket_link__successor_ticket_id__ticket_identity FOREIGN KEY (successor_ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.purpose_extension_binding ADD CONSTRAINT fk_purpose_extension_binding__compatibility_declaration_id__compatibility_declaration FOREIGN KEY (compatibility_declaration_id) REFERENCES appts.compatibility_declaration (compatibility_declaration_id) ON DELETE RESTRICT;
ALTER TABLE appts.assignment_snapshot ADD CONSTRAINT fk_assignment_snapshot__source_version_ref_id__source_version_ref FOREIGN KEY (source_version_ref_id) REFERENCES appts.source_version_ref (source_version_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.authority_envelope ADD CONSTRAINT fk_authority_envelope__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.authority_envelope ADD CONSTRAINT fk_authority_envelope__responsibility_id__responsible_assignment FOREIGN KEY (responsibility_id) REFERENCES appts.responsible_assignment (responsibility_id) ON DELETE RESTRICT;
ALTER TABLE appts.authority_envelope ADD CONSTRAINT fk_authority_envelope__sod_decision_ref__sod_decision FOREIGN KEY (sod_decision_ref) REFERENCES appts.sod_decision (sod_decision_id) ON DELETE RESTRICT;
ALTER TABLE appts.authority_action ADD CONSTRAINT fk_authority_action__authority_result_id__authority_envelope FOREIGN KEY (authority_result_id) REFERENCES appts.authority_envelope (authority_result_id) ON DELETE RESTRICT;
ALTER TABLE appts.responsible_assignment ADD CONSTRAINT fk_responsible_assignment__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.responsible_assignment ADD CONSTRAINT fk_responsible_assignment__assignment_snapshot_id__assignment_snapshot FOREIGN KEY (assignment_snapshot_id) REFERENCES appts.assignment_snapshot (assignment_snapshot_id) ON DELETE RESTRICT;
ALTER TABLE appts.responsible_assignment ADD CONSTRAINT fk_responsible_assignment__predecessor_responsibility_id__responsible_assignment FOREIGN KEY (predecessor_responsibility_id) REFERENCES appts.responsible_assignment (responsibility_id) ON DELETE RESTRICT;
ALTER TABLE appts.responsible_assignment ADD CONSTRAINT fk_responsible_assignment__handover_response_id__handover_response FOREIGN KEY (handover_response_id) REFERENCES appts.handover_response (handover_response_id) ON DELETE RESTRICT;
ALTER TABLE appts.handover_proposal ADD CONSTRAINT fk_handover_proposal__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.handover_proposal ADD CONSTRAINT fk_handover_proposal__current_responsibility_id__responsible_assignment FOREIGN KEY (current_responsibility_id) REFERENCES appts.responsible_assignment (responsibility_id) ON DELETE RESTRICT;
ALTER TABLE appts.handover_response ADD CONSTRAINT fk_handover_response__handover_proposal_id__handover_proposal FOREIGN KEY (handover_proposal_id) REFERENCES appts.handover_proposal (handover_proposal_id) ON DELETE RESTRICT;
ALTER TABLE appts.responsibility_change ADD CONSTRAINT fk_responsibility_change__handover_proposal_id__handover_proposal FOREIGN KEY (handover_proposal_id) REFERENCES appts.handover_proposal (handover_proposal_id) ON DELETE RESTRICT;
ALTER TABLE appts.responsibility_change ADD CONSTRAINT fk_responsibility_change__handover_response_id__handover_response FOREIGN KEY (handover_response_id) REFERENCES appts.handover_response (handover_response_id) ON DELETE RESTRICT;
ALTER TABLE appts.responsibility_change ADD CONSTRAINT fk_responsibility_change__prior_responsibility_id__responsible_assignment FOREIGN KEY (prior_responsibility_id) REFERENCES appts.responsible_assignment (responsibility_id) ON DELETE RESTRICT;
ALTER TABLE appts.responsibility_change ADD CONSTRAINT fk_responsibility_change__successor_responsibility_id__responsible_assignment FOREIGN KEY (successor_responsibility_id) REFERENCES appts.responsible_assignment (responsibility_id) ON DELETE RESTRICT;
ALTER TABLE appts.responsibility_change ADD CONSTRAINT fk_responsibility_change__commit_marker_id__commit_marker FOREIGN KEY (commit_marker_id) REFERENCES appts.commit_marker (commit_marker_id) ON DELETE RESTRICT;
ALTER TABLE appts.delegation_grant ADD CONSTRAINT fk_delegation_grant__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.delegation_grant ADD CONSTRAINT fk_delegation_grant__accountability_responsibility_id__responsible_assignment FOREIGN KEY (accountability_responsibility_id) REFERENCES appts.responsible_assignment (responsibility_id) ON DELETE RESTRICT;
ALTER TABLE appts.escalation_obligation_core ADD CONSTRAINT fk_escalation_obligation_core__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.escalation_obligation_core ADD CONSTRAINT fk_escalation_obligation_core__responsibility_id__responsible_assignment FOREIGN KEY (responsibility_id) REFERENCES appts.responsible_assignment (responsibility_id) ON DELETE RESTRICT;
ALTER TABLE appts.sod_decision ADD CONSTRAINT fk_sod_decision__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.authority_refresh ADD CONSTRAINT fk_authority_refresh__prior_authority_result_id__authority_envelope FOREIGN KEY (prior_authority_result_id) REFERENCES appts.authority_envelope (authority_result_id) ON DELETE RESTRICT;
ALTER TABLE appts.authority_refresh ADD CONSTRAINT fk_authority_refresh__result_authority_id__authority_envelope FOREIGN KEY (result_authority_id) REFERENCES appts.authority_envelope (authority_result_id) ON DELETE RESTRICT;
ALTER TABLE appts.evidence_object ADD CONSTRAINT fk_evidence_object__integrity_envelope_id__integrity_envelope FOREIGN KEY (integrity_envelope_id) REFERENCES appts.integrity_envelope (integrity_envelope_id) ON DELETE RESTRICT;
ALTER TABLE appts.evidence_qualification ADD CONSTRAINT fk_evidence_qualification__evidence_id__evidence_object FOREIGN KEY (evidence_id) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.evidence_qualification ADD CONSTRAINT fk_evidence_qualification__predecessor_qualification_id__evidence_qualification FOREIGN KEY (predecessor_qualification_id) REFERENCES appts.evidence_qualification (qualification_id) ON DELETE RESTRICT;
ALTER TABLE appts.evidence_correction ADD CONSTRAINT fk_evidence_correction__original_evidence_id__evidence_object FOREIGN KEY (original_evidence_id) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.evidence_correction ADD CONSTRAINT fk_evidence_correction__successor_evidence_or_interpretation_ref__evidence_object FOREIGN KEY (successor_evidence_or_interpretation_ref) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.evidence_correction ADD CONSTRAINT fk_evidence_correction__evidence_ref__evidence_object FOREIGN KEY (evidence_ref) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.claim_record ADD CONSTRAINT fk_claim_record__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.claim_evidence_link ADD CONSTRAINT fk_claim_evidence_link__claim_id__claim_record FOREIGN KEY (claim_id) REFERENCES appts.claim_record (claim_id) ON DELETE RESTRICT;
ALTER TABLE appts.claim_evidence_link ADD CONSTRAINT fk_claim_evidence_link__evidence_id__evidence_object FOREIGN KEY (evidence_id) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.contradiction_set ADD CONSTRAINT fk_contradiction_set__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.contradiction_member ADD CONSTRAINT fk_contradiction_member__contradiction_id__contradiction_set FOREIGN KEY (contradiction_id) REFERENCES appts.contradiction_set (contradiction_id) ON DELETE RESTRICT;
ALTER TABLE appts.evidence_set_version ADD CONSTRAINT fk_evidence_set_version__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.evidence_set_version ADD CONSTRAINT fk_evidence_set_version__predecessor_set_version_id__evidence_set_version FOREIGN KEY (predecessor_set_version_id) REFERENCES appts.evidence_set_version (evidence_set_version_id) ON DELETE RESTRICT;
ALTER TABLE appts.evidence_set_member ADD CONSTRAINT fk_evidence_set_member__evidence_set_version_id__evidence_set_version FOREIGN KEY (evidence_set_version_id) REFERENCES appts.evidence_set_version (evidence_set_version_id) ON DELETE RESTRICT;
ALTER TABLE appts.evidence_set_member ADD CONSTRAINT fk_evidence_set_member__evidence_id__evidence_object FOREIGN KEY (evidence_id) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.evidence_set_member ADD CONSTRAINT fk_evidence_set_member__qualification_id__evidence_qualification FOREIGN KEY (qualification_id) REFERENCES appts.evidence_qualification (qualification_id) ON DELETE RESTRICT;
ALTER TABLE appts.verification_request ADD CONSTRAINT fk_verification_request__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.verification_request ADD CONSTRAINT fk_verification_request__evidence_set_version_id__evidence_set_version FOREIGN KEY (evidence_set_version_id) REFERENCES appts.evidence_set_version (evidence_set_version_id) ON DELETE RESTRICT;
ALTER TABLE appts.verifier_eligibility_decision ADD CONSTRAINT fk_verifier_eligibility_decision__verification_request_id__verification_request FOREIGN KEY (verification_request_id) REFERENCES appts.verification_request (verification_request_id) ON DELETE RESTRICT;
ALTER TABLE appts.verifier_eligibility_decision ADD CONSTRAINT fk_verifier_eligibility_decision__authority_result_ref__authority_envelope FOREIGN KEY (authority_result_ref) REFERENCES appts.authority_envelope (authority_result_id) ON DELETE RESTRICT;
ALTER TABLE appts.verifier_eligibility_decision ADD CONSTRAINT fk_verifier_eligibility_decision__sod_decision_id__sod_decision FOREIGN KEY (sod_decision_id) REFERENCES appts.sod_decision (sod_decision_id) ON DELETE RESTRICT;
ALTER TABLE appts.verification_result ADD CONSTRAINT fk_verification_result__verification_request_id__verification_request FOREIGN KEY (verification_request_id) REFERENCES appts.verification_request (verification_request_id) ON DELETE RESTRICT;
ALTER TABLE appts.verification_result ADD CONSTRAINT fk_verification_result__evidence_set_version_id__evidence_set_version FOREIGN KEY (evidence_set_version_id) REFERENCES appts.evidence_set_version (evidence_set_version_id) ON DELETE RESTRICT;
ALTER TABLE appts.verification_result ADD CONSTRAINT fk_verification_result__eligibility_decision_id__verifier_eligibility_decision FOREIGN KEY (eligibility_decision_id) REFERENCES appts.verifier_eligibility_decision (eligibility_decision_id) ON DELETE RESTRICT;
ALTER TABLE appts.verification_result ADD CONSTRAINT fk_verification_result__predecessor_result_id__verification_result FOREIGN KEY (predecessor_result_id) REFERENCES appts.verification_result (verification_result_id) ON DELETE RESTRICT;
ALTER TABLE appts.gate_evaluation ADD CONSTRAINT fk_gate_evaluation__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.gate_evaluation ADD CONSTRAINT fk_gate_evaluation__evidence_set_version_id__evidence_set_version FOREIGN KEY (evidence_set_version_id) REFERENCES appts.evidence_set_version (evidence_set_version_id) ON DELETE RESTRICT;
ALTER TABLE appts.gate_evaluation ADD CONSTRAINT fk_gate_evaluation__authority_result_ref__authority_envelope FOREIGN KEY (authority_result_ref) REFERENCES appts.authority_envelope (authority_result_id) ON DELETE RESTRICT;
ALTER TABLE appts.gate_evaluation ADD CONSTRAINT fk_gate_evaluation__verification_result_ref__verification_result FOREIGN KEY (verification_result_ref) REFERENCES appts.verification_result (verification_result_id) ON DELETE RESTRICT;
ALTER TABLE appts.gate_evaluation ADD CONSTRAINT fk_gate_evaluation__policy_binding_ref__policy_binding_ref FOREIGN KEY (policy_binding_ref) REFERENCES appts.policy_binding_ref (policy_binding_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.gate_evaluation ADD CONSTRAINT fk_gate_evaluation__predecessor_gate_evaluation_id__gate_evaluation FOREIGN KEY (predecessor_gate_evaluation_id) REFERENCES appts.gate_evaluation (gate_evaluation_id) ON DELETE RESTRICT;
ALTER TABLE appts.gate_predicate_result ADD CONSTRAINT fk_gate_predicate_result__gate_evaluation_id__gate_evaluation FOREIGN KEY (gate_evaluation_id) REFERENCES appts.gate_evaluation (gate_evaluation_id) ON DELETE RESTRICT;
ALTER TABLE appts.progression_envelope ADD CONSTRAINT fk_progression_envelope__gate_evaluation_id__gate_evaluation FOREIGN KEY (gate_evaluation_id) REFERENCES appts.gate_evaluation (gate_evaluation_id) ON DELETE RESTRICT;
ALTER TABLE appts.progression_envelope ADD CONSTRAINT fk_progression_envelope__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.progression_envelope ADD CONSTRAINT fk_progression_envelope__predecessor_envelope_id__progression_envelope FOREIGN KEY (predecessor_envelope_id) REFERENCES appts.progression_envelope (envelope_id) ON DELETE RESTRICT;
ALTER TABLE appts.progression_class ADD CONSTRAINT fk_progression_class__envelope_id__progression_envelope FOREIGN KEY (envelope_id) REFERENCES appts.progression_envelope (envelope_id) ON DELETE RESTRICT;
ALTER TABLE appts.terminal_disposition_assessment ADD CONSTRAINT fk_terminal_disposition_assessment__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.terminal_disposition_assessment ADD CONSTRAINT fk_terminal_disposition_assessment__evidence_set_version_id__evidence_set_version FOREIGN KEY (evidence_set_version_id) REFERENCES appts.evidence_set_version (evidence_set_version_id) ON DELETE RESTRICT;
ALTER TABLE appts.terminal_disposition_assessment ADD CONSTRAINT fk_terminal_disposition_assessment__verification_result_ref__verification_result FOREIGN KEY (verification_result_ref) REFERENCES appts.verification_result (verification_result_id) ON DELETE RESTRICT;
ALTER TABLE appts.closure_readiness_assessment ADD CONSTRAINT fk_closure_readiness_assessment__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.closure_readiness_assessment ADD CONSTRAINT fk_closure_readiness_assessment__disposition_assessment_id__terminal_disposition_assessment FOREIGN KEY (disposition_assessment_id) REFERENCES appts.terminal_disposition_assessment (disposition_assessment_id) ON DELETE RESTRICT;
ALTER TABLE appts.inbox_entry ADD CONSTRAINT fk_inbox_entry__integrity_envelope_id__integrity_envelope FOREIGN KEY (integrity_envelope_id) REFERENCES appts.integrity_envelope (integrity_envelope_id) ON DELETE RESTRICT;
ALTER TABLE appts.outbox_entry ADD CONSTRAINT fk_outbox_entry__integrity_envelope_id__integrity_envelope FOREIGN KEY (integrity_envelope_id) REFERENCES appts.integrity_envelope (integrity_envelope_id) ON DELETE RESTRICT;
ALTER TABLE appts.outbox_entry ADD CONSTRAINT fk_outbox_entry__producer_commit_marker_id__commit_marker FOREIGN KEY (producer_commit_marker_id) REFERENCES appts.commit_marker (commit_marker_id) ON DELETE RESTRICT;
ALTER TABLE appts.access_audit ADD CONSTRAINT fk_access_audit__audit_event_id__audit_event FOREIGN KEY (audit_event_id) REFERENCES appts.audit_event (audit_event_id) ON DELETE RESTRICT;
ALTER TABLE appts.export_manifest_item ADD CONSTRAINT fk_export_manifest_item__export_manifest_id__export_manifest FOREIGN KEY (export_manifest_id) REFERENCES appts.export_manifest (export_manifest_id) ON DELETE RESTRICT;
ALTER TABLE appts.compatibility_declaration ADD CONSTRAINT fk_compatibility_declaration__predecessor_release_ref__release_identity FOREIGN KEY (predecessor_release_ref) REFERENCES appts.release_identity (release_identity_id) ON DELETE RESTRICT;
ALTER TABLE appts.compatibility_declaration ADD CONSTRAINT fk_compatibility_declaration__successor_release_ref__release_identity FOREIGN KEY (successor_release_ref) REFERENCES appts.release_identity (release_identity_id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX uq_responsible_assignment__current_ticket_domain ON appts.responsible_assignment (ticket_id, domain_id) WHERE effective_to IS NULL;
CREATE INDEX ix_responsible_assignment__history ON appts.responsible_assignment (ticket_id, domain_id, effective_from DESC);
CREATE INDEX ix_admission_assessment__case_time ON appts.admission_assessment (case_id, evaluated_at DESC);
CREATE INDEX ix_intake_decision__case_time ON appts.intake_decision (case_id, decided_at DESC);
CREATE INDEX ix_relationship_record__source ON appts.relationship_record (source_subject_type, source_subject_id, relationship_type);
CREATE INDEX ix_relationship_record__target ON appts.relationship_record (target_subject_type, target_subject_id, relationship_type);
CREATE INDEX ix_authority_envelope__ticket_domain_time ON appts.authority_envelope (ticket_id, domain_id, effective_from DESC);
CREATE INDEX ix_evidence_object__ticket_time ON appts.evidence_object (ticket_id, committed_at DESC) WHERE ticket_id IS NOT NULL;
CREATE INDEX ix_evidence_object__subject_time ON appts.evidence_object (subject_type, subject_id, committed_at DESC);
CREATE INDEX ix_evidence_qualification__evidence_time ON appts.evidence_qualification (evidence_id, assessed_at DESC);
CREATE INDEX ix_claim_record__ticket_type_time ON appts.claim_record (ticket_id, claim_type_ref, claim_time DESC);
CREATE INDEX ix_contradiction_set__ticket_type ON appts.contradiction_set (ticket_id, contradiction_type_ref);
CREATE INDEX ix_verification_request__ticket_set_time ON appts.verification_request (ticket_id, evidence_set_version_id, requested_at DESC);
CREATE INDEX ix_verification_result__request_time ON appts.verification_result (verification_request_id, completed_at DESC);
CREATE INDEX ix_gate_evaluation__ticket_gate_time ON appts.gate_evaluation (ticket_id, gate_identity, evaluated_at DESC);
CREATE INDEX ix_progression_envelope__ticket_time ON appts.progression_envelope (ticket_id, effective_from DESC);
CREATE UNIQUE INDEX uq_inbox_entry__message_identity ON appts.inbox_entry (interface_identity, semantic_version, producer_ref_id, producer_ref_code, message_id) NULLS NOT DISTINCT;
CREATE INDEX ix_inbox_entry__correlation ON appts.inbox_entry (correlation_id);
CREATE INDEX ix_idempotency_ledger__command_message ON appts.idempotency_ledger (command_or_message_identity);
CREATE INDEX ix_outbox_entry__pending ON appts.outbox_entry (publication_status_ref, next_attempt_at) WHERE published_at IS NULL;
CREATE INDEX ix_outbox_entry__commit ON appts.outbox_entry (producer_commit_marker_id);
CREATE INDEX ix_audit_event__ticket_commit ON appts.audit_event (ticket_id, committed_at DESC) WHERE ticket_id IS NOT NULL;
CREATE INDEX ix_audit_event__correlation_commit ON appts.audit_event (correlation_id, committed_at DESC);
CREATE INDEX ix_audit_event__subject_commit ON appts.audit_event (subject_type, subject_id, committed_at DESC);
CREATE INDEX ix_audit_event__event_commit ON appts.audit_event (event_identity, committed_at DESC);
CREATE INDEX ix_audit_event__actor_commit ON appts.audit_event (actor_ref, committed_at DESC) WHERE actor_ref IS NOT NULL;
CREATE INDEX ix_lineage_edge__predecessor ON appts.lineage_edge (predecessor_type, predecessor_id);
CREATE INDEX ix_lineage_edge__successor ON appts.lineage_edge (successor_type, successor_id);
CREATE INDEX ix_export_manifest_item__manifest ON appts.export_manifest_item (export_manifest_id);
CREATE UNIQUE INDEX uq_export_manifest_item__source ON appts.export_manifest_item (export_manifest_id, source_record_type, source_record_id, source_record_version_ref) NULLS NOT DISTINCT;
CREATE INDEX ix_export_manifest__job ON appts.export_manifest (export_job_id) WHERE export_job_id IS NOT NULL;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['admission_assessment','admission_predicate_result','intake_decision','ticket_formation_record','incident_record','relationship_record','post_closure_correction','successor_ticket_link','handover_proposal','handover_response','responsibility_change','delegation_grant','escalation_obligation_core','sod_decision','evidence_object','evidence_qualification','evidence_correction','claim_record','interpretation_record','claim_evidence_link','contradiction_set','contradiction_member','evidence_set_version','evidence_set_member','verification_request','verifier_eligibility_decision','verification_result','gate_evaluation','gate_predicate_result','progression_class','terminal_disposition_assessment','closure_readiness_assessment','source_ref','source_version_ref','policy_binding_ref','configuration_snapshot','missing_binding_result','integrity_envelope','lineage_edge','idempotency_ledger','inbox_entry','commit_marker','audit_event','access_audit','export_manifest_item','release_identity','compatibility_declaration']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON appts.%I FOR EACH ROW EXECUTE FUNCTION appts.reject_canonical_mutation()',
      'trg_' || table_name || '__append_only', table_name
    );
  END LOOP;
END
$$;
