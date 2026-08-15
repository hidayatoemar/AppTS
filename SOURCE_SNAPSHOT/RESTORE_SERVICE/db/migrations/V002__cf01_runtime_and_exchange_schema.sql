-- CF06-B01 / CODEX-EXEC-003
-- CF-01 Runtime D-04, exchange D-05/D-06 and cross-phase constraints.
SET TIME ZONE 'UTC';
SET search_path = appts, pg_catalog;
CREATE TABLE appts.runtime_ticket (
  ticket_id uuid DEFAULT gen_random_uuid() NOT NULL,
  current_state_code text COLLATE "C" NOT NULL,
  aggregate_version bigint NOT NULL,
  activation_record_ref uuid NOT NULL,
  purpose_binding_id uuid NOT NULL,
  current_context_version bigint NOT NULL,
  current_state_transition_id uuid,
  current_responsibility_projection_id uuid,
  current_authority_projection_id uuid,
  current_gate_projection_id uuid,
  last_effect_result_id uuid,
  updated_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_runtime_ticket PRIMARY KEY (ticket_id),
  CONSTRAINT ck_runtime_ticket__aggregate_version_nonnegative CHECK (aggregate_version >= 0),
  CONSTRAINT ck_runtime_ticket__current_context_version_nonnegative CHECK (current_context_version >= 0)
);

CREATE TABLE appts.runtime_context (
  runtime_context_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  context_version bigint NOT NULL,
  purpose_binding_id uuid NOT NULL,
  domain_id uuid NOT NULL,
  source_context_refs_id uuid,
  source_context_refs_json jsonb,
  source_context_refs_json_schema_version text COLLATE "C",
  predecessor_context_id uuid,
  currentness_ref text COLLATE "C" NOT NULL,
  committed_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_runtime_context PRIMARY KEY (runtime_context_id),
  CONSTRAINT ck_runtime_context__source_context_refs_branch CHECK (num_nonnulls(source_context_refs_id, source_context_refs_json) <= 1),
  CONSTRAINT ck_runtime_context__source_context_refs_json_version CHECK ((source_context_refs_json IS NULL) = (source_context_refs_json_schema_version IS NULL)),
  CONSTRAINT ck_runtime_context__source_context_refs_json_schema CHECK ((source_context_refs_json IS NULL) = (source_context_refs_json_schema_version IS NULL)),
  CONSTRAINT ck_runtime_context__context_version_nonnegative CHECK (context_version >= 0)
);

CREATE TABLE appts.runtime_state_transition (
  transition_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  from_state_code text COLLATE "C" NOT NULL,
  to_state_code text COLLATE "C" NOT NULL,
  lifecycle_effect_request_id uuid NOT NULL,
  lifecycle_effect_result_id uuid NOT NULL,
  authority_projection_ref uuid NOT NULL,
  gate_projection_ref uuid NOT NULL,
  actor_ref uuid,
  reason_ref text COLLATE "C",
  evidence_or_gate_ref uuid,
  effective_at timestamptz(3) NOT NULL,
  committed_at timestamptz(3) NOT NULL,
  prior_aggregate_version bigint NOT NULL,
  resulting_aggregate_version bigint NOT NULL,
  correlation_id uuid NOT NULL,
  CONSTRAINT pk_runtime_state_transition PRIMARY KEY (transition_id),
  CONSTRAINT ck_runtime_state_transition__prior_aggregate_version_nonnegative CHECK (prior_aggregate_version >= 0),
  CONSTRAINT ck_runtime_state_transition__resulting_aggregate_version_nonnegative CHECK (resulting_aggregate_version >= 0)
);

CREATE TABLE appts.lifecycle_effect_request (
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
  authority_ref uuid,
  qualification_ref uuid,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  effect_request_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  requested_effect_class text COLLATE "C" NOT NULL,
  expected_aggregate_version bigint NOT NULL,
  authority_result_ref text COLLATE "C" NOT NULL,
  gate_result_ref text COLLATE "C" NOT NULL,
  actor_ref uuid NOT NULL,
  command_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  requested_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_lifecycle_effect_request PRIMARY KEY (effect_request_id),
  CONSTRAINT ck_lifecycle_effect_request__expected_aggregate_version_nonnegative CHECK (expected_aggregate_version >= 0)
);

CREATE TABLE appts.lifecycle_effect_result (
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
  effect_result_id uuid DEFAULT gen_random_uuid() NOT NULL,
  effect_request_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  result_code text COLLATE "C" NOT NULL,
  effect_disposition_code text COLLATE "C" NOT NULL,
  reason_ref text COLLATE "C",
  prior_aggregate_version bigint NOT NULL,
  resulting_aggregate_version bigint,
  state_transition_id uuid,
  durable_commit_marker_id uuid NOT NULL,
  outbox_result_ref text COLLATE "C",
  CONSTRAINT pk_lifecycle_effect_result PRIMARY KEY (effect_result_id),
  CONSTRAINT ck_lifecycle_effect_result__prior_aggregate_version_nonnegative CHECK (prior_aggregate_version >= 0),
  CONSTRAINT ck_lifecycle_effect_result__resulting_aggregate_version_nonnegative CHECK (resulting_aggregate_version >= 0)
);

CREATE TABLE appts.authority_projection (
  projection_version bigint NOT NULL CHECK (projection_version >= 0),
  rebuilt_at timestamptz(3) NOT NULL,
  authority_projection_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  source_authority_result_id uuid NOT NULL,
  source_version_ref text COLLATE "C" NOT NULL,
  permitted_action_set_ref jsonb NOT NULL,
  permitted_action_set_ref_schema_version text COLLATE "C" NOT NULL,
  responsible_assignment_ref uuid NOT NULL,
  effective_from timestamptz(3) NOT NULL,
  effective_to timestamptz(3),
  currentness_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_authority_projection PRIMARY KEY (authority_projection_id),
  CONSTRAINT ck_authority_projection__permitted_action_set_ref_schema CHECK ((permitted_action_set_ref IS NULL) = (permitted_action_set_ref_schema_version IS NULL)),
  CONSTRAINT ck_authority_projection__effective_from_effective_to CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE appts.gate_projection (
  projection_version bigint NOT NULL CHECK (projection_version >= 0),
  rebuilt_at timestamptz(3) NOT NULL,
  gate_projection_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  source_gate_result_id uuid NOT NULL,
  source_version_ref text COLLATE "C" NOT NULL,
  progression_envelope_ref uuid NOT NULL,
  effective_from timestamptz(3) NOT NULL,
  effective_to timestamptz(3),
  currentness_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_gate_projection PRIMARY KEY (gate_projection_id),
  CONSTRAINT ck_gate_projection__effective_from_effective_to CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE appts.action_set_snapshot (
  projection_version bigint NOT NULL CHECK (projection_version >= 0),
  currentness_ref text COLLATE "C" NOT NULL,
  rebuilt_at timestamptz(3) NOT NULL,
  action_set_snapshot_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  aggregate_version bigint NOT NULL,
  authority_projection_id uuid NOT NULL,
  gate_projection_id uuid NOT NULL,
  restriction_profile_ref text COLLATE "C",
  derived_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_action_set_snapshot PRIMARY KEY (action_set_snapshot_id),
  CONSTRAINT ck_action_set_snapshot__aggregate_version_nonnegative CHECK (aggregate_version >= 0)
);

CREATE TABLE appts.action_set_member (
  action_set_member_id uuid DEFAULT gen_random_uuid() NOT NULL,
  action_set_snapshot_id uuid NOT NULL,
  action_class_ref text COLLATE "C" NOT NULL,
  availability_result_ref text COLLATE "C" NOT NULL,
  withholding_reason_ref text COLLATE "C",
  CONSTRAINT pk_action_set_member PRIMARY KEY (action_set_member_id)
);

CREATE TABLE appts.next_control (
  next_control_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  aggregate_version bigint NOT NULL,
  control_class_ref text COLLATE "C" NOT NULL,
  owner_or_responsibility_ref text COLLATE "C" NOT NULL,
  source_obligation_ref uuid,
  due_basis_ref text COLLATE "C",
  effective_at timestamptz(3) NOT NULL,
  currentness_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_next_control PRIMARY KEY (next_control_id),
  CONSTRAINT ck_next_control__aggregate_version_nonnegative CHECK (aggregate_version >= 0)
);

CREATE TABLE appts.operational_obligation (
  obligation_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  obligation_class_ref text COLLATE "C" NOT NULL,
  owner_or_responsibility_ref text COLLATE "C" NOT NULL,
  source_ref uuid NOT NULL,
  source_effective_at timestamptz(3),
  due_basis_ref text COLLATE "C",
  due_at timestamptz(3),
  next_evaluation_at timestamptz(3),
  status_ref text COLLATE "C" NOT NULL,
  fulfillment_evidence_ref uuid,
  predecessor_obligation_id uuid,
  CONSTRAINT pk_operational_obligation PRIMARY KEY (obligation_id)
);

CREATE TABLE appts.waiting_interval (
  waiting_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  obligation_id uuid,
  blocker_id uuid,
  dependency_context_id uuid,
  waiting_reason_ref_id uuid,
  waiting_reason_ref_code text COLLATE "C",
  responsible_owner_ref text COLLATE "C" NOT NULL,
  external_party_ref uuid,
  started_at timestamptz(3) NOT NULL,
  ended_at timestamptz(3),
  expected_obligation_ref uuid,
  request_evidence_ref uuid,
  acceptance_or_rejection_evidence_ref uuid,
  fulfillment_or_exception_evidence_ref uuid,
  predecessor_waiting_id uuid,
  CONSTRAINT pk_waiting_interval PRIMARY KEY (waiting_id),
  CONSTRAINT ck_waiting_interval__waiting_reason_ref_branch CHECK (num_nonnulls(waiting_reason_ref_id, waiting_reason_ref_code) = 1),
  CONSTRAINT ck_waiting_interval__started_at_ended_at CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE appts.runtime_blocker (
  blocker_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  blocked_work_ref uuid NOT NULL,
  unmet_dependency_ref text COLLATE "C",
  blocker_reason_ref text COLLATE "C" NOT NULL,
  owner_ref text COLLATE "C" NOT NULL,
  started_at timestamptz(3) NOT NULL,
  cleared_at timestamptz(3),
  expected_obligation_ref uuid,
  downstream_impact_ref uuid,
  escalation_ref uuid,
  evidence_ref uuid,
  status_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_runtime_blocker PRIMARY KEY (blocker_id)
);

CREATE TABLE appts.runtime_escalation (
  runtime_escalation_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  source_escalation_obligation_ref uuid NOT NULL,
  current_level_or_route_ref_id uuid,
  current_level_or_route_ref_code text COLLATE "C",
  intervention_due_basis_ref text COLLATE "C",
  status_ref text COLLATE "C" NOT NULL,
  evidence_ref uuid,
  predecessor_runtime_escalation_id uuid,
  CONSTRAINT pk_runtime_escalation PRIMARY KEY (runtime_escalation_id),
  CONSTRAINT ck_runtime_escalation__current_level_or_route_ref_branch CHECK (num_nonnulls(current_level_or_route_ref_id, current_level_or_route_ref_code) = 1)
);

CREATE TABLE appts.acknowledgment (
  acknowledgment_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  subject_type text COLLATE "C" NOT NULL,
  subject_id uuid NOT NULL,
  acknowledged_by_ref uuid NOT NULL,
  acknowledged_at timestamptz(3) NOT NULL,
  result_ref text COLLATE "C" NOT NULL,
  evidence_ref uuid,
  CONSTRAINT pk_acknowledgment PRIMARY KEY (acknowledgment_id)
);

CREATE TABLE appts.runtime_handover_context (
  runtime_handover_context_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  source_handover_ref uuid NOT NULL,
  prior_responsibility_ref uuid NOT NULL,
  proposed_or_successor_responsibility_ref uuid,
  acceptance_status_ref text COLLATE "C" NOT NULL,
  effective_at timestamptz(3),
  currentness_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_runtime_handover_context PRIMARY KEY (runtime_handover_context_id)
);

CREATE TABLE appts.subordinate_projection (
  projection_version bigint NOT NULL CHECK (projection_version >= 0),
  rebuilt_at timestamptz(3) NOT NULL,
  subordinate_projection_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  subordinate_type_ref text COLLATE "C" NOT NULL,
  external_record_ref uuid NOT NULL,
  source_system_ref uuid NOT NULL,
  source_version_ref text COLLATE "C" NOT NULL,
  status_ref text COLLATE "C",
  currentness_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_subordinate_projection PRIMARY KEY (subordinate_projection_id)
);

CREATE TABLE appts.dependency_context (
  projection_version bigint NOT NULL CHECK (projection_version >= 0),
  rebuilt_at timestamptz(3) NOT NULL,
  dependency_context_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  dependency_type_ref text COLLATE "C" NOT NULL,
  external_or_internal_subject_ref uuid NOT NULL,
  source_system_ref uuid,
  source_version_ref text COLLATE "C",
  dependency_status_ref text COLLATE "C" NOT NULL,
  waiting_since timestamptz(3),
  currentness_ref text COLLATE "C" NOT NULL,
  evidence_ref uuid,
  CONSTRAINT pk_dependency_context PRIMARY KEY (dependency_context_id)
);

CREATE TABLE appts.residual_obligation (
  residual_obligation_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  obligation_ref uuid NOT NULL,
  disposition_status_ref text COLLATE "C" NOT NULL,
  disposition_reason_ref text COLLATE "C",
  evidence_ref uuid,
  successor_ticket_requirement_ref uuid,
  predecessor_residual_id uuid,
  CONSTRAINT pk_residual_obligation PRIMARY KEY (residual_obligation_id)
);

CREATE TABLE appts.aoua_record (
  aoua_record_id uuid DEFAULT gen_random_uuid() NOT NULL,
  authorization_identity text COLLATE "C" NOT NULL,
  issuer_ref text COLLATE "C" NOT NULL,
  deployment_binding_ref text COLLATE "C" NOT NULL,
  valid_from timestamptz(3) NOT NULL,
  expires_at timestamptz(3) NOT NULL,
  authorization_status_ref text COLLATE "C" NOT NULL,
  integrity_envelope_id uuid NOT NULL,
  source_version_ref text COLLATE "C" NOT NULL,
  recorded_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_aoua_record PRIMARY KEY (aoua_record_id),
  CONSTRAINT ck_aoua_record__valid_from_expires_at CHECK (expires_at IS NULL OR expires_at >= valid_from)
);

CREATE TABLE appts.authorization_transition (
  authorization_transition_id uuid DEFAULT gen_random_uuid() NOT NULL,
  aoua_record_id uuid NOT NULL,
  from_mode_ref text COLLATE "C" NOT NULL,
  to_mode_ref text COLLATE "C" NOT NULL,
  transition_basis_ref text COLLATE "C" NOT NULL,
  effective_at timestamptz(3) NOT NULL,
  evidence_ref uuid NOT NULL,
  CONSTRAINT pk_authorization_transition PRIMARY KEY (authorization_transition_id)
);

CREATE TABLE appts.restriction_profile_ref (
  restriction_profile_ref_id uuid DEFAULT gen_random_uuid() NOT NULL,
  policy_binding_ref text COLLATE "C" NOT NULL,
  profile_identity text COLLATE "C" NOT NULL,
  profile_version bigint NOT NULL,
  effective_from timestamptz(3) NOT NULL,
  effective_to timestamptz(3),
  currentness_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_restriction_profile_ref PRIMARY KEY (restriction_profile_ref_id),
  CONSTRAINT ck_restriction_profile_ref__profile_version_nonnegative CHECK (profile_version >= 0),
  CONSTRAINT ck_restriction_profile_ref__effective_from_effective_to CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE appts.package_binding_runtime (
  runtime_package_binding_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  purpose_extension_binding_id uuid NOT NULL,
  runtime_release_identity_id uuid NOT NULL,
  compatibility_declaration_id uuid NOT NULL,
  bound_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_package_binding_runtime PRIMARY KEY (runtime_package_binding_id)
);

CREATE TABLE appts.hook_invocation (
  hook_invocation_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  hook_identity text COLLATE "C" NOT NULL,
  package_binding_id uuid NOT NULL,
  input_version_ref text COLLATE "C" NOT NULL,
  invoked_at timestamptz(3) NOT NULL,
  correlation_id uuid NOT NULL,
  CONSTRAINT pk_hook_invocation PRIMARY KEY (hook_invocation_id)
);

CREATE TABLE appts.hook_result (
  hook_result_id uuid DEFAULT gen_random_uuid() NOT NULL,
  hook_invocation_id uuid NOT NULL,
  result_code text COLLATE "C" NOT NULL,
  output_ref uuid,
  committed_at timestamptz(3) NOT NULL,
  predecessor_result_id uuid,
  CONSTRAINT pk_hook_result PRIMARY KEY (hook_result_id)
);

CREATE TABLE appts.stub_result (
  stub_result_id uuid DEFAULT gen_random_uuid() NOT NULL,
  stub_identity text COLLATE "C" NOT NULL,
  invocation_or_context_ref jsonb NOT NULL,
  invocation_or_context_ref_schema_version text COLLATE "C" NOT NULL,
  result_code text COLLATE "C" NOT NULL,
  evidence_ref uuid,
  committed_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_stub_result PRIMARY KEY (stub_result_id),
  CONSTRAINT ck_stub_result__invocation_or_context_ref_schema CHECK ((invocation_or_context_ref IS NULL) = (invocation_or_context_ref_schema_version IS NULL))
);

CREATE TABLE appts.authoritative_source_ref (
  source_system_ref_id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_identity text COLLATE "C" NOT NULL,
  source_version_or_profile_ref text COLLATE "C",
  authoritative_subject_class_ref text COLLATE "C" NOT NULL,
  owner_ref text COLLATE "C" NOT NULL,
  currentness_ref text COLLATE "C" NOT NULL,
  effective_from timestamptz(3) NOT NULL,
  effective_to timestamptz(3),
  CONSTRAINT pk_authoritative_source_ref PRIMARY KEY (source_system_ref_id),
  CONSTRAINT ck_authoritative_source_ref__effective_from_effective_to CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE appts.adapter_profile_ref (
  adapter_profile_ref_id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_system_ref_id uuid NOT NULL,
  adapter_profile_identity text COLLATE "C" NOT NULL,
  adapter_profile_version bigint NOT NULL,
  qualification_rules_ref uuid NOT NULL,
  effective_from timestamptz(3) NOT NULL,
  effective_to timestamptz(3),
  CONSTRAINT pk_adapter_profile_ref PRIMARY KEY (adapter_profile_ref_id),
  CONSTRAINT ck_adapter_profile_ref__adapter_profile_version_nonnegative CHECK (adapter_profile_version >= 0),
  CONSTRAINT ck_adapter_profile_ref__effective_from_effective_to CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE appts.qualified_external_record (
  record_version bigint CHECK (record_version >= 0),
  ticket_id uuid,
  domain_id uuid,
  purpose_binding_id uuid,
  source_ref_id uuid,
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
  correlation_id uuid,
  causation_id uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  qualified_external_record_id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_system_ref_id uuid NOT NULL,
  external_record_identity text COLLATE "C" NOT NULL,
  external_record_version_ref text COLLATE "C" NOT NULL,
  subject_ref uuid NOT NULL,
  qualification_result_ref text COLLATE "C" NOT NULL,
  source_time timestamptz(3),
  received_at timestamptz(3) NOT NULL,
  payload_or_reference_ref_kind text COLLATE "C" NOT NULL,
  payload_or_reference_ref_uri text,
  payload_or_reference_ref_json jsonb,
  payload_or_reference_ref_json_schema_version text COLLATE "C",
  payload_hash text COLLATE "C",
  currentness_ref text COLLATE "C" NOT NULL,
  contradiction_ref uuid,
  CONSTRAINT pk_qualified_external_record PRIMARY KEY (qualified_external_record_id),
  CONSTRAINT ck_qualified_external_record__payload_or_reference_ref_branch CHECK (((payload_or_reference_ref_kind = 'URI' AND payload_or_reference_ref_uri IS NOT NULL) OR (payload_or_reference_ref_kind = 'JSON' AND payload_or_reference_ref_json IS NOT NULL AND payload_or_reference_ref_json_schema_version IS NOT NULL))),
  CONSTRAINT ck_qualified_external_record__payload_or_reference_ref_json_schema CHECK ((payload_or_reference_ref_json IS NULL) = (payload_or_reference_ref_json_schema_version IS NULL))
);

CREATE TABLE appts.interaction_journal (
  interaction_journal_id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_system_ref_id uuid NOT NULL,
  adapter_profile_ref_id uuid NOT NULL,
  interaction_identity text COLLATE "C" NOT NULL,
  request_ref uuid NOT NULL,
  state_code text COLLATE "C" NOT NULL,
  attempt_count bigint NOT NULL,
  last_transition_at timestamptz(3) NOT NULL,
  timeout_basis_ref text COLLATE "C",
  result_ref text COLLATE "C",
  reconciliation_case_id uuid,
  CONSTRAINT pk_interaction_journal PRIMARY KEY (interaction_journal_id),
  CONSTRAINT ck_interaction_journal__attempt_count_nonnegative CHECK (attempt_count >= 0)
);

CREATE TABLE appts.pending_capture (
  pending_capture_id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_system_ref_id uuid NOT NULL,
  subject_ref uuid NOT NULL,
  captured_by_ref uuid NOT NULL,
  capture_time timestamptz(3) NOT NULL,
  source_label_ref text COLLATE "C" NOT NULL,
  provisional_payload_ref uuid NOT NULL,
  sync_status_ref text COLLATE "C" NOT NULL,
  reconciliation_case_id uuid,
  CONSTRAINT pk_pending_capture PRIMARY KEY (pending_capture_id)
);

CREATE TABLE appts.sync_batch (
  sync_batch_id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_system_ref_id uuid NOT NULL,
  started_at timestamptz(3) NOT NULL,
  completed_at timestamptz(3),
  status_ref text COLLATE "C" NOT NULL,
  cursor_or_source_version_ref text COLLATE "C",
  item_count bigint,
  CONSTRAINT pk_sync_batch PRIMARY KEY (sync_batch_id),
  CONSTRAINT ck_sync_batch__item_count_nonnegative CHECK (item_count >= 0),
  CONSTRAINT ck_sync_batch__started_at_completed_at CHECK (completed_at IS NULL OR completed_at >= started_at)
);

CREATE TABLE appts.sync_result (
  sync_result_id uuid DEFAULT gen_random_uuid() NOT NULL,
  sync_batch_id uuid NOT NULL,
  pending_capture_or_external_record_ref uuid NOT NULL,
  result_code text COLLATE "C" NOT NULL,
  source_record_ref uuid,
  contradiction_ref uuid,
  correction_ref uuid,
  processed_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_sync_result PRIMARY KEY (sync_result_id)
);

CREATE TABLE appts.reconciliation_case (
  reconciliation_case_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid,
  subject_ref uuid NOT NULL,
  trigger_type_ref text COLLATE "C" NOT NULL,
  conflicting_record_refs jsonb NOT NULL,
  conflicting_record_refs_schema_version text COLLATE "C" NOT NULL,
  status_ref text COLLATE "C" NOT NULL,
  authoritative_resolution_ref uuid,
  resolution_reason_ref text COLLATE "C",
  opened_at timestamptz(3) NOT NULL,
  resolved_at timestamptz(3),
  audit_ref uuid,
  CONSTRAINT pk_reconciliation_case PRIMARY KEY (reconciliation_case_id),
  CONSTRAINT ck_reconciliation_case__conflicting_record_refs_schema CHECK ((conflicting_record_refs IS NULL) = (conflicting_record_refs_schema_version IS NULL)),
  CONSTRAINT ck_reconciliation_case__opened_at_resolved_at CHECK (resolved_at IS NULL OR resolved_at >= opened_at)
);

CREATE TABLE appts.operational_view_projection (
  projection_version bigint NOT NULL CHECK (projection_version >= 0),
  currentness_ref text COLLATE "C" NOT NULL,
  rebuilt_at timestamptz(3) NOT NULL,
  operational_view_projection_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  role_or_domain_scope_ref jsonb NOT NULL,
  role_or_domain_scope_ref_schema_version text COLLATE "C" NOT NULL,
  source_aggregate_version bigint NOT NULL,
  disclosure_profile_ref text COLLATE "C" NOT NULL,
  projection_payload_ref jsonb NOT NULL,
  projection_payload_ref_schema_version text COLLATE "C" NOT NULL,
  generated_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_operational_view_projection PRIMARY KEY (operational_view_projection_id),
  CONSTRAINT ck_operational_view_projection__role_or_domain_scope_ref_schema CHECK ((role_or_domain_scope_ref IS NULL) = (role_or_domain_scope_ref_schema_version IS NULL)),
  CONSTRAINT ck_operational_view_projection__projection_payload_ref_schema CHECK ((projection_payload_ref IS NULL) = (projection_payload_ref_schema_version IS NULL)),
  CONSTRAINT ck_operational_view_projection__source_aggregate_version_nonnegative CHECK (source_aggregate_version >= 0)
);

CREATE TABLE appts.action_intent (
  action_intent_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  actor_ref uuid NOT NULL,
  role_assignment_ref uuid NOT NULL,
  requested_action_class text COLLATE "C" NOT NULL,
  presented_source_version_ref text COLLATE "C" NOT NULL,
  expected_aggregate_version bigint NOT NULL,
  intent_time timestamptz(3) NOT NULL,
  correlation_id uuid NOT NULL,
  result_effect_request_ref text COLLATE "C",
  CONSTRAINT pk_action_intent PRIMARY KEY (action_intent_id),
  CONSTRAINT ck_action_intent__expected_aggregate_version_nonnegative CHECK (expected_aggregate_version >= 0)
);

CREATE TABLE appts.communication_obligation (
  communication_obligation_id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  obligation_class_ref text COLLATE "C" NOT NULL,
  audience_ref uuid,
  channel_policy_ref text COLLATE "C",
  content_or_template_policy_ref text COLLATE "C",
  due_basis_ref text COLLATE "C",
  status_ref text COLLATE "C" NOT NULL,
  source_reason_ref text COLLATE "C" NOT NULL,
  predecessor_obligation_id uuid,
  CONSTRAINT pk_communication_obligation PRIMARY KEY (communication_obligation_id)
);

CREATE TABLE appts.communication_attempt (
  communication_attempt_id uuid DEFAULT gen_random_uuid() NOT NULL,
  communication_obligation_id uuid NOT NULL,
  attempt_identity text COLLATE "C" NOT NULL,
  channel_ref text COLLATE "C" NOT NULL,
  provider_ref text COLLATE "C",
  initiated_at timestamptz(3) NOT NULL,
  payload_or_template_ref uuid,
  correlation_id uuid NOT NULL,
  delivery_tracking_ref text COLLATE "C",
  CONSTRAINT pk_communication_attempt PRIMARY KEY (communication_attempt_id)
);

CREATE TABLE appts.communication_result (
  communication_result_id uuid DEFAULT gen_random_uuid() NOT NULL,
  communication_attempt_id uuid NOT NULL,
  provider_or_channel_result_ref text COLLATE "C",
  semantic_completion_result_ref text COLLATE "C" NOT NULL,
  received_at timestamptz(3),
  evidence_ref uuid,
  reason_ref text COLLATE "C",
  CONSTRAINT pk_communication_result PRIMARY KEY (communication_result_id)
);

CREATE TABLE appts.export_job (
  export_job_id uuid DEFAULT gen_random_uuid() NOT NULL,
  requested_by_ref uuid NOT NULL,
  authorized_scope_ref jsonb NOT NULL,
  authorized_scope_ref_schema_version text COLLATE "C" NOT NULL,
  requested_at timestamptz(3) NOT NULL,
  export_manifest_id uuid NOT NULL,
  status_ref text COLLATE "C" NOT NULL,
  completed_at timestamptz(3),
  failure_reason_ref text COLLATE "C",
  CONSTRAINT pk_export_job PRIMARY KEY (export_job_id),
  CONSTRAINT ck_export_job__authorized_scope_ref_schema CHECK ((authorized_scope_ref IS NULL) = (authorized_scope_ref_schema_version IS NULL))
);
ALTER TABLE appts.lifecycle_effect_result ADD CONSTRAINT uq_lifecycle_effect_result__request UNIQUE (effect_request_id);
ALTER TABLE appts.lifecycle_effect_result ADD CONSTRAINT ck_lifecycle_effect_result__disposition CHECK (effect_disposition_code IN ('EFFECT_APPLIED','NO_EFFECT'));
ALTER TABLE appts.runtime_state_transition ADD CONSTRAINT uq_runtime_state_transition__ticket_version UNIQUE (ticket_id, resulting_aggregate_version);
ALTER TABLE appts.runtime_state_transition ADD CONSTRAINT ck_runtime_state_transition__from_state CHECK (from_state_code IN ('ACCEPTED','ACTIVE','TERMINAL_PROCESSING','CLOSED'));
ALTER TABLE appts.runtime_state_transition ADD CONSTRAINT ck_runtime_state_transition__to_state CHECK (to_state_code IN ('ACCEPTED','ACTIVE','TERMINAL_PROCESSING','CLOSED'));
ALTER TABLE appts.action_set_member ADD CONSTRAINT uq_action_set_member__snapshot_action UNIQUE (action_set_snapshot_id, action_class_ref);
ALTER TABLE appts.qualified_external_record ADD CONSTRAINT uq_qualified_external_record__source_identity_version UNIQUE (source_system_ref_id, external_record_identity, external_record_version_ref);
ALTER TABLE appts.interaction_journal ADD CONSTRAINT uq_interaction_journal__source_interaction UNIQUE (source_system_ref_id, interaction_identity);
ALTER TABLE appts.interaction_journal ADD CONSTRAINT ck_interaction_journal__state CHECK (state_code IN ('REQUESTED','SENT','TRANSPORT_ACCEPTED','QUALIFIED_RESULT','FAILED','TIMED_OUT','UNCERTAIN','MANUAL_FALLBACK','RECONCILIATION_PENDING','RECONCILED'));
ALTER TABLE appts.lifecycle_effect_request ADD CONSTRAINT uq_lifecycle_effect_request__ticket_idempotency UNIQUE (ticket_id, idempotency_key);
ALTER TABLE appts.lifecycle_effect_request ADD CONSTRAINT uq_lifecycle_effect_request__command UNIQUE (command_id);
ALTER TABLE appts.runtime_ticket ADD CONSTRAINT ck_runtime_ticket__state CHECK (current_state_code IN ('ACCEPTED','ACTIVE','TERMINAL_PROCESSING','CLOSED'));
ALTER TABLE appts.runtime_ticket ADD CONSTRAINT fk_runtime_ticket__ticket_id__ticket_identity FOREIGN KEY (ticket_id) REFERENCES appts.ticket_identity (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.runtime_ticket ADD CONSTRAINT fk_runtime_ticket__purpose_binding_id__purpose_extension_binding FOREIGN KEY (purpose_binding_id) REFERENCES appts.purpose_extension_binding (binding_id) ON DELETE RESTRICT;
ALTER TABLE appts.runtime_context ADD CONSTRAINT fk_runtime_context__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.runtime_context ADD CONSTRAINT fk_runtime_context__purpose_binding_id__purpose_extension_binding FOREIGN KEY (purpose_binding_id) REFERENCES appts.purpose_extension_binding (binding_id) ON DELETE RESTRICT;
ALTER TABLE appts.runtime_state_transition ADD CONSTRAINT fk_runtime_state_transition__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.runtime_state_transition ADD CONSTRAINT fk_runtime_state_transition__lifecycle_effect_request_id__lifecycle_effect_request FOREIGN KEY (lifecycle_effect_request_id) REFERENCES appts.lifecycle_effect_request (effect_request_id) ON DELETE RESTRICT;
ALTER TABLE appts.runtime_state_transition ADD CONSTRAINT fk_runtime_state_transition__lifecycle_effect_result_id__lifecycle_effect_result FOREIGN KEY (lifecycle_effect_result_id) REFERENCES appts.lifecycle_effect_result (effect_result_id) ON DELETE RESTRICT;
ALTER TABLE appts.lifecycle_effect_request ADD CONSTRAINT fk_lifecycle_effect_request__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.lifecycle_effect_result ADD CONSTRAINT fk_lifecycle_effect_result__effect_request_id__lifecycle_effect_request FOREIGN KEY (effect_request_id) REFERENCES appts.lifecycle_effect_request (effect_request_id) ON DELETE RESTRICT;
ALTER TABLE appts.lifecycle_effect_result ADD CONSTRAINT fk_lifecycle_effect_result__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.lifecycle_effect_result ADD CONSTRAINT fk_lifecycle_effect_result__state_transition_id__runtime_state_transition FOREIGN KEY (state_transition_id) REFERENCES appts.runtime_state_transition (transition_id) ON DELETE RESTRICT;
ALTER TABLE appts.authority_projection ADD CONSTRAINT fk_authority_projection__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.gate_projection ADD CONSTRAINT fk_gate_projection__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.action_set_snapshot ADD CONSTRAINT fk_action_set_snapshot__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.action_set_snapshot ADD CONSTRAINT fk_action_set_snapshot__authority_projection_id__authority_projection FOREIGN KEY (authority_projection_id) REFERENCES appts.authority_projection (authority_projection_id) ON DELETE RESTRICT;
ALTER TABLE appts.action_set_snapshot ADD CONSTRAINT fk_action_set_snapshot__gate_projection_id__gate_projection FOREIGN KEY (gate_projection_id) REFERENCES appts.gate_projection (gate_projection_id) ON DELETE RESTRICT;
ALTER TABLE appts.action_set_member ADD CONSTRAINT fk_action_set_member__action_set_snapshot_id__action_set_snapshot FOREIGN KEY (action_set_snapshot_id) REFERENCES appts.action_set_snapshot (action_set_snapshot_id) ON DELETE RESTRICT;
ALTER TABLE appts.next_control ADD CONSTRAINT fk_next_control__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.operational_obligation ADD CONSTRAINT fk_operational_obligation__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.waiting_interval ADD CONSTRAINT fk_waiting_interval__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.waiting_interval ADD CONSTRAINT fk_waiting_interval__obligation_id__operational_obligation FOREIGN KEY (obligation_id) REFERENCES appts.operational_obligation (obligation_id) ON DELETE RESTRICT;
ALTER TABLE appts.waiting_interval ADD CONSTRAINT fk_waiting_interval__blocker_id__runtime_blocker FOREIGN KEY (blocker_id) REFERENCES appts.runtime_blocker (blocker_id) ON DELETE RESTRICT;
ALTER TABLE appts.waiting_interval ADD CONSTRAINT fk_waiting_interval__dependency_context_id__dependency_context FOREIGN KEY (dependency_context_id) REFERENCES appts.dependency_context (dependency_context_id) ON DELETE RESTRICT;
ALTER TABLE appts.runtime_blocker ADD CONSTRAINT fk_runtime_blocker__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.runtime_escalation ADD CONSTRAINT fk_runtime_escalation__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.acknowledgment ADD CONSTRAINT fk_acknowledgment__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.runtime_handover_context ADD CONSTRAINT fk_runtime_handover_context__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.subordinate_projection ADD CONSTRAINT fk_subordinate_projection__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.dependency_context ADD CONSTRAINT fk_dependency_context__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.residual_obligation ADD CONSTRAINT fk_residual_obligation__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.aoua_record ADD CONSTRAINT fk_aoua_record__integrity_envelope_id__integrity_envelope FOREIGN KEY (integrity_envelope_id) REFERENCES appts.integrity_envelope (integrity_envelope_id) ON DELETE RESTRICT;
ALTER TABLE appts.authorization_transition ADD CONSTRAINT fk_authorization_transition__aoua_record_id__aoua_record FOREIGN KEY (aoua_record_id) REFERENCES appts.aoua_record (aoua_record_id) ON DELETE RESTRICT;
ALTER TABLE appts.package_binding_runtime ADD CONSTRAINT fk_package_binding_runtime__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.package_binding_runtime ADD CONSTRAINT fk_package_binding_runtime__purpose_extension_binding_id__purpose_extension_binding FOREIGN KEY (purpose_extension_binding_id) REFERENCES appts.purpose_extension_binding (binding_id) ON DELETE RESTRICT;
ALTER TABLE appts.package_binding_runtime ADD CONSTRAINT fk_package_binding_runtime__runtime_release_identity_id__release_identity FOREIGN KEY (runtime_release_identity_id) REFERENCES appts.release_identity (release_identity_id) ON DELETE RESTRICT;
ALTER TABLE appts.package_binding_runtime ADD CONSTRAINT fk_package_binding_runtime__compatibility_declaration_id__compatibility_declaration FOREIGN KEY (compatibility_declaration_id) REFERENCES appts.compatibility_declaration (compatibility_declaration_id) ON DELETE RESTRICT;
ALTER TABLE appts.hook_invocation ADD CONSTRAINT fk_hook_invocation__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.hook_result ADD CONSTRAINT fk_hook_result__hook_invocation_id__hook_invocation FOREIGN KEY (hook_invocation_id) REFERENCES appts.hook_invocation (hook_invocation_id) ON DELETE RESTRICT;
ALTER TABLE appts.adapter_profile_ref ADD CONSTRAINT fk_adapter_profile_ref__source_system_ref_id__authoritative_source_ref FOREIGN KEY (source_system_ref_id) REFERENCES appts.authoritative_source_ref (source_system_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.qualified_external_record ADD CONSTRAINT fk_qualified_external_record__source_system_ref_id__authoritative_source_ref FOREIGN KEY (source_system_ref_id) REFERENCES appts.authoritative_source_ref (source_system_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.interaction_journal ADD CONSTRAINT fk_interaction_journal__source_system_ref_id__authoritative_source_ref FOREIGN KEY (source_system_ref_id) REFERENCES appts.authoritative_source_ref (source_system_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.interaction_journal ADD CONSTRAINT fk_interaction_journal__adapter_profile_ref_id__adapter_profile_ref FOREIGN KEY (adapter_profile_ref_id) REFERENCES appts.adapter_profile_ref (adapter_profile_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.interaction_journal ADD CONSTRAINT fk_interaction_journal__reconciliation_case_id__reconciliation_case FOREIGN KEY (reconciliation_case_id) REFERENCES appts.reconciliation_case (reconciliation_case_id) ON DELETE RESTRICT;
ALTER TABLE appts.pending_capture ADD CONSTRAINT fk_pending_capture__source_system_ref_id__authoritative_source_ref FOREIGN KEY (source_system_ref_id) REFERENCES appts.authoritative_source_ref (source_system_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.pending_capture ADD CONSTRAINT fk_pending_capture__reconciliation_case_id__reconciliation_case FOREIGN KEY (reconciliation_case_id) REFERENCES appts.reconciliation_case (reconciliation_case_id) ON DELETE RESTRICT;
ALTER TABLE appts.sync_batch ADD CONSTRAINT fk_sync_batch__source_system_ref_id__authoritative_source_ref FOREIGN KEY (source_system_ref_id) REFERENCES appts.authoritative_source_ref (source_system_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.sync_result ADD CONSTRAINT fk_sync_result__sync_batch_id__sync_batch FOREIGN KEY (sync_batch_id) REFERENCES appts.sync_batch (sync_batch_id) ON DELETE RESTRICT;
ALTER TABLE appts.operational_view_projection ADD CONSTRAINT fk_operational_view_projection__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.action_intent ADD CONSTRAINT fk_action_intent__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.communication_obligation ADD CONSTRAINT fk_communication_obligation__ticket_id__runtime_ticket FOREIGN KEY (ticket_id) REFERENCES appts.runtime_ticket (ticket_id) ON DELETE RESTRICT;
ALTER TABLE appts.communication_attempt ADD CONSTRAINT fk_communication_attempt__communication_obligation_id__communication_obligation FOREIGN KEY (communication_obligation_id) REFERENCES appts.communication_obligation (communication_obligation_id) ON DELETE RESTRICT;
ALTER TABLE appts.communication_result ADD CONSTRAINT fk_communication_result__communication_attempt_id__communication_attempt FOREIGN KEY (communication_attempt_id) REFERENCES appts.communication_attempt (communication_attempt_id) ON DELETE RESTRICT;
ALTER TABLE appts.export_job ADD CONSTRAINT fk_export_job__export_manifest_id__export_manifest FOREIGN KEY (export_manifest_id) REFERENCES appts.export_manifest (export_manifest_id) ON DELETE RESTRICT;
ALTER TABLE appts.export_manifest ADD CONSTRAINT fk_export_manifest__export_job_id__export_job FOREIGN KEY (export_job_id) REFERENCES appts.export_job (export_job_id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX uq_authority_projection__current_ticket ON appts.authority_projection (ticket_id) WHERE effective_to IS NULL;
CREATE UNIQUE INDEX uq_gate_projection__current_ticket ON appts.gate_projection (ticket_id) WHERE effective_to IS NULL;
CREATE INDEX ix_runtime_state_transition__ticket_commit ON appts.runtime_state_transition (ticket_id, committed_at DESC);
CREATE INDEX ix_operational_obligation__ticket_next_eval ON appts.operational_obligation (ticket_id, next_evaluation_at) WHERE next_evaluation_at IS NOT NULL;
CREATE INDEX ix_waiting_interval__open_ticket_start ON appts.waiting_interval (ticket_id, started_at) WHERE ended_at IS NULL;
CREATE INDEX ix_runtime_blocker__open_ticket_start ON appts.runtime_blocker (ticket_id, started_at) WHERE cleared_at IS NULL;
CREATE INDEX ix_dependency_context__waiting ON appts.dependency_context (ticket_id, waiting_since) WHERE waiting_since IS NOT NULL;
CREATE INDEX ix_qualified_external_record__source_currentness ON appts.qualified_external_record (source_system_ref_id, currentness_ref);
CREATE INDEX ix_interaction_journal__source_state_time ON appts.interaction_journal (source_system_ref_id, state_code, last_transition_at DESC);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['runtime_context','runtime_state_transition','lifecycle_effect_request','lifecycle_effect_result','action_set_member','next_control','runtime_escalation','acknowledgment','runtime_handover_context','subordinate_projection','dependency_context','residual_obligation','authorization_transition','package_binding_runtime','hook_invocation','hook_result','stub_result','authoritative_source_ref','adapter_profile_ref','qualified_external_record','interaction_journal','pending_capture','sync_batch','sync_result','reconciliation_case','action_intent','communication_obligation','communication_attempt','communication_result','export_job']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON appts.%I FOR EACH ROW EXECUTE FUNCTION appts.reject_canonical_mutation()',
      'trg_' || table_name || '__append_only', table_name
    );
  END LOOP;
END
$$;
