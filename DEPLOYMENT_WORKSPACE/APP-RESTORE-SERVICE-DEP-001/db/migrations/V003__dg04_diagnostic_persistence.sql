-- CF06-B01 / CODEX-EXEC-003
-- DG-04 additive diagnostic persistence, CF-01 v0.2.2 T101-T117.
SET TIME ZONE 'UTC';
SET search_path = appts, pg_catalog;
CREATE TABLE appts.diagnostic_error_event (
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
  authority_ref uuid,
  qualification_ref uuid,
  predecessor_record_id uuid,
  supersedes_record_id uuid,
  error_event_id uuid DEFAULT gen_random_uuid() NOT NULL,
  occurred_at timestamptz(3) NOT NULL,
  correlation_id uuid NOT NULL,
  causation_id uuid,
  trace_id text COLLATE "C",
  span_id text COLLATE "C",
  environment_ref text COLLATE "C" NOT NULL,
  application_ref text COLLATE "C" NOT NULL,
  service_ref text COLLATE "C",
  module_ref text COLLATE "C",
  component_ref text COLLATE "C" NOT NULL,
  build_version_ref text COLLATE "C" NOT NULL,
  source_revision_or_commit_ref text COLLATE "C" NOT NULL,
  configuration_version_ref text COLLATE "C" NOT NULL,
  configuration_snapshot_id uuid,
  operation_identity text COLLATE "C" NOT NULL,
  actor_ref uuid,
  role_or_assignment_ref uuid,
  state_before_ref text COLLATE "C",
  attempted_action_or_transition_ref text COLLATE "C",
  resulting_state_or_effect_ref text COLLATE "C",
  mapping_entry_id uuid NOT NULL,
  canonical_error_code text COLLATE "C" NOT NULL,
  error_category_ref text COLLATE "C" NOT NULL,
  severity_ref text COLLATE "C" NOT NULL,
  exception_type_ref text COLLATE "C",
  payload_fingerprint bytea,
  transaction_commit_status_ref text COLLATE "C",
  diagnostic_effect_status text COLLATE "C" NOT NULL,
  retryability_status_ref text COLLATE "C" NOT NULL,
  retryability_reason_ref text COLLATE "C",
  reconciliation_case_id uuid,
  root_cause_status text COLLATE "C" NOT NULL,
  remediation_hint_or_runbook_ref text COLLATE "C",
  diagnostic_owner_or_queue_ref text COLLATE "C" NOT NULL,
  safe_user_reference_code text COLLATE "C" NOT NULL,
  safe_message_key text COLLATE "C" NOT NULL,
  committed_at timestamptz(3) NOT NULL,
  disclosure_label_ref uuid NOT NULL,
  integrity_envelope_id uuid,
  CONSTRAINT pk_diagnostic_error_event PRIMARY KEY (error_event_id)
);

CREATE TABLE appts.diagnostic_event_subject (
  diagnostic_event_subject_id uuid DEFAULT gen_random_uuid() NOT NULL,
  error_event_id uuid NOT NULL,
  subject_type_ref text COLLATE "C" NOT NULL,
  subject_ref_id uuid,
  subject_ref_code text COLLATE "C",
  source_ref_id uuid,
  source_version_ref_id uuid,
  linked_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_diagnostic_event_subject PRIMARY KEY (diagnostic_event_subject_id)
);

CREATE TABLE appts.secure_diagnostic_bundle (
  diagnostic_bundle_id uuid DEFAULT gen_random_uuid() NOT NULL,
  error_event_id uuid NOT NULL,
  bundle_version bigint NOT NULL,
  retrieval_ref text COLLATE "C" NOT NULL,
  integrity_envelope_id uuid,
  disclosure_label_ref uuid NOT NULL,
  created_at timestamptz(3) NOT NULL,
  predecessor_bundle_id uuid,
  supersedes_bundle_id uuid,
  superseded_at timestamptz(3),
  CONSTRAINT pk_secure_diagnostic_bundle PRIMARY KEY (diagnostic_bundle_id),
  CONSTRAINT ck_secure_diagnostic_bundle__bundle_version_nonnegative CHECK (bundle_version >= 0)
);

CREATE TABLE appts.diagnostic_bundle_member (
  bundle_member_id uuid DEFAULT gen_random_uuid() NOT NULL,
  diagnostic_bundle_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  member_class_ref text COLLATE "C" NOT NULL,
  sequence_no bigint NOT NULL,
  included_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_diagnostic_bundle_member PRIMARY KEY (bundle_member_id),
  CONSTRAINT ck_diagnostic_bundle_member__sequence_no_nonnegative CHECK (sequence_no >= 0)
);

CREATE TABLE appts.diagnostic_dependency_evidence (
  dependency_evidence_id uuid DEFAULT gen_random_uuid() NOT NULL,
  error_event_id uuid NOT NULL,
  dependency_ref text COLLATE "C" NOT NULL,
  source_system_ref_id uuid,
  adapter_profile_ref_id uuid,
  dependency_request_identity text COLLATE "C" NOT NULL,
  response_or_result_ref text COLLATE "C",
  latency_ms bigint,
  timeout_evidence_ref uuid,
  evidence_id uuid NOT NULL,
  observed_at timestamptz(3),
  committed_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_diagnostic_dependency_evidence PRIMARY KEY (dependency_evidence_id),
  CONSTRAINT ck_diagnostic_dependency_evidence__latency_ms_nonnegative CHECK (latency_ms >= 0)
);

CREATE TABLE appts.diagnostic_mapping_registry_version (
  registry_version_id uuid DEFAULT gen_random_uuid() NOT NULL,
  registry_identity text COLLATE "C" NOT NULL,
  registry_version text COLLATE "C" NOT NULL,
  configuration_snapshot_id uuid NOT NULL,
  effective_from timestamptz(3) NOT NULL,
  effective_to timestamptz(3),
  currentness_ref text COLLATE "C" NOT NULL,
  status_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_diagnostic_mapping_registry_version PRIMARY KEY (registry_version_id),
  CONSTRAINT ck_diag_map_reg_ver__effective_from_effective_to CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE appts.diagnostic_mapping_entry (
  mapping_entry_id uuid DEFAULT gen_random_uuid() NOT NULL,
  registry_version_id uuid NOT NULL,
  implementation_failure_identity text COLLATE "C" NOT NULL,
  canonical_error_code text COLLATE "C" NOT NULL,
  error_category_ref text COLLATE "C" NOT NULL,
  severity_ref text COLLATE "C" NOT NULL,
  effect_classification_rule_ref text COLLATE "C" NOT NULL,
  retryability_rule_ref text COLLATE "C" NOT NULL,
  reconciliation_rule_ref text COLLATE "C" NOT NULL,
  safe_user_message_key text COLLATE "C" NOT NULL,
  diagnostic_owner_or_queue_ref text COLLATE "C" NOT NULL,
  required_evidence_set_ref text COLLATE "C" NOT NULL,
  required_test_vector_ref text COLLATE "C" NOT NULL,
  CONSTRAINT pk_diagnostic_mapping_entry PRIMARY KEY (mapping_entry_id)
);

CREATE TABLE appts.diagnostic_notification (
  notification_id uuid DEFAULT gen_random_uuid() NOT NULL,
  error_event_id uuid NOT NULL,
  diagnostic_bundle_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  channel_class text COLLATE "C" NOT NULL,
  routing_configuration_snapshot_id uuid NOT NULL,
  resolved_role_or_queue_ref text COLLATE "C" NOT NULL,
  sanitized_payload_evidence_id uuid NOT NULL,
  outbox_entry_id uuid NOT NULL,
  aggregation_group_id uuid,
  fallback_from_notification_id uuid,
  produced_at timestamptz(3) NOT NULL,
  queued_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_diagnostic_notification PRIMARY KEY (notification_id)
);

CREATE TABLE appts.diagnostic_notification_attempt (
  notification_attempt_id uuid DEFAULT gen_random_uuid() NOT NULL,
  notification_id uuid NOT NULL,
  attempt_sequence bigint NOT NULL,
  provider_adapter_ref text COLLATE "C",
  delivery_correlation_id uuid NOT NULL,
  initiated_at timestamptz(3) NOT NULL,
  issued_at timestamptz(3),
  timeout_basis_configuration_snapshot_id uuid,
  retry_of_attempt_id uuid,
  CONSTRAINT pk_diagnostic_notification_attempt PRIMARY KEY (notification_attempt_id),
  CONSTRAINT ck_diag_notif_att__att_sequence_nonnegative CHECK (attempt_sequence >= 1)
);

CREATE TABLE appts.diagnostic_notification_result (
  notification_result_id uuid DEFAULT gen_random_uuid() NOT NULL,
  notification_attempt_id uuid NOT NULL,
  delivery_result_class_ref text COLLATE "C" NOT NULL,
  provider_or_transport_result_ref text COLLATE "C",
  result_at timestamptz(3) NOT NULL,
  evidence_id uuid,
  retry_disposition_ref text COLLATE "C",
  fallback_or_escalation_ref text COLLATE "C",
  routing_configuration_snapshot_id uuid,
  CONSTRAINT pk_diagnostic_notification_result PRIMARY KEY (notification_result_id)
);

CREATE TABLE appts.diagnostic_notification_dead_letter (
  dead_letter_id uuid DEFAULT gen_random_uuid() NOT NULL,
  notification_id uuid NOT NULL,
  notification_attempt_id uuid NOT NULL,
  notification_result_id uuid NOT NULL,
  reason_ref text COLLATE "C" NOT NULL,
  evidence_id uuid,
  recorded_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_diagnostic_notification_dead_letter PRIMARY KEY (dead_letter_id)
);

CREATE TABLE appts.diagnostic_notification_acknowledgment (
  diagnostic_notification_ack_id uuid DEFAULT gen_random_uuid() NOT NULL,
  notification_id uuid NOT NULL,
  notification_attempt_id uuid,
  notification_result_id uuid,
  acknowledgment_code text COLLATE "C" NOT NULL,
  acknowledged_by_ref text COLLATE "C",
  acknowledged_at timestamptz(3) NOT NULL,
  evidence_id uuid,
  correlation_id uuid NOT NULL,
  CONSTRAINT pk_diagnostic_notification_acknowledgment PRIMARY KEY (diagnostic_notification_ack_id)
);

CREATE TABLE appts.diagnostic_aggregation_group (
  aggregation_group_id uuid DEFAULT gen_random_uuid() NOT NULL,
  diagnostic_fingerprint bytea NOT NULL,
  storm_control_configuration_snapshot_id uuid NOT NULL,
  first_seen_at timestamptz(3) NOT NULL,
  latest_seen_at timestamptz(3) NOT NULL,
  occurrence_count bigint NOT NULL,
  current_summary_evidence_id uuid,
  updated_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_diagnostic_aggregation_group PRIMARY KEY (aggregation_group_id),
  CONSTRAINT ck_diagnostic_aggregation_group__occurrence_count_nonnegative CHECK (occurrence_count >= 1),
  CONSTRAINT ck_diagnostic_aggregation_group__first_seen_at_latest_seen_at CHECK (latest_seen_at IS NULL OR latest_seen_at >= first_seen_at)
);

CREATE TABLE appts.diagnostic_aggregation_member (
  aggregation_member_id uuid DEFAULT gen_random_uuid() NOT NULL,
  aggregation_group_id uuid NOT NULL,
  error_event_id uuid NOT NULL,
  included_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_diagnostic_aggregation_member PRIMARY KEY (aggregation_member_id)
);

CREATE TABLE appts.diagnostic_storm_control_decision (
  storm_control_decision_id uuid DEFAULT gen_random_uuid() NOT NULL,
  error_event_id uuid NOT NULL,
  aggregation_group_id uuid,
  configuration_snapshot_id uuid NOT NULL,
  decision_class_ref text COLLATE "C" NOT NULL,
  reason_ref text COLLATE "C" NOT NULL,
  evidence_id uuid,
  decided_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_diagnostic_storm_control_decision PRIMARY KEY (storm_control_decision_id)
);

CREATE TABLE appts.diagnostic_notification_failure_link (
  notification_failure_link_id uuid DEFAULT gen_random_uuid() NOT NULL,
  failed_notification_attempt_id uuid NOT NULL,
  parent_error_event_id uuid NOT NULL,
  child_error_event_id uuid NOT NULL,
  root_error_event_id uuid NOT NULL,
  recursion_depth bigint NOT NULL,
  storm_control_configuration_snapshot_id uuid NOT NULL,
  storm_control_decision_id uuid,
  linked_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_diagnostic_notification_failure_link PRIMARY KEY (notification_failure_link_id),
  CONSTRAINT ck_diag_notif_fail_link__recursion_depth_nonnegative CHECK (recursion_depth >= 1)
);

CREATE TABLE appts.diagnostic_event_correction (
  diagnostic_event_correction_id uuid DEFAULT gen_random_uuid() NOT NULL,
  original_error_event_id uuid NOT NULL,
  corrected_scope_ref text COLLATE "C" NOT NULL,
  predecessor_bundle_id uuid NOT NULL,
  successor_bundle_id uuid NOT NULL,
  reason_ref text COLLATE "C" NOT NULL,
  evidence_id uuid NOT NULL,
  predecessor_correction_id uuid,
  committed_at timestamptz(3) NOT NULL,
  CONSTRAINT pk_diagnostic_event_correction PRIMARY KEY (diagnostic_event_correction_id)
);
ALTER TABLE appts.diagnostic_error_event ADD CONSTRAINT ck_diagnostic_error_event__effect_status CHECK (diagnostic_effect_status IN ('NO_EFFECT','EFFECT_CONFIRMED','EFFECT_UNCERTAIN_RECONCILIATION_REQUIRED'));
ALTER TABLE appts.diagnostic_error_event ADD CONSTRAINT ck_diagnostic_error_event__root_cause CHECK (root_cause_status IN ('SUSPECTED','CONFIRMED','UNDETERMINED'));
ALTER TABLE appts.diagnostic_event_subject ADD CONSTRAINT ck_diagnostic_event_subject__subject_branch CHECK (num_nonnulls(subject_ref_id, subject_ref_code) = 1);
ALTER TABLE appts.diagnostic_notification ADD CONSTRAINT ck_diagnostic_notification__channel CHECK (channel_class IN ('WHATSAPP','EMAIL'));
ALTER TABLE appts.diagnostic_notification_acknowledgment ADD CONSTRAINT ck_diagnostic_notification_acknowledgment__code CHECK (acknowledgment_code IN ('RECEIVED','ACKNOWLEDGED'));
ALTER TABLE appts.diagnostic_notification_failure_link ADD CONSTRAINT ck_diagnostic_notification_failure_link__parent_child CHECK (parent_error_event_id <> child_error_event_id);
ALTER TABLE appts.diagnostic_event_correction ADD CONSTRAINT ck_diagnostic_event_correction__bundle_successor CHECK (predecessor_bundle_id <> successor_bundle_id);
ALTER TABLE appts.diagnostic_event_subject ADD CONSTRAINT fk_diag_evt_subject__error_evt_id__diag_error_evt FOREIGN KEY (error_event_id) REFERENCES appts.diagnostic_error_event (error_event_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_event_subject ADD CONSTRAINT fk_diagnostic_event_subject__source_ref_id__source_ref FOREIGN KEY (source_ref_id) REFERENCES appts.source_ref (source_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_event_subject ADD CONSTRAINT fk_diag_evt_subject__src_ver_ref_id__src_ver_ref FOREIGN KEY (source_version_ref_id) REFERENCES appts.source_version_ref (source_version_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.secure_diagnostic_bundle ADD CONSTRAINT fk_secure_diag_bndl__error_evt_id__diag_error_evt FOREIGN KEY (error_event_id) REFERENCES appts.diagnostic_error_event (error_event_id) ON DELETE RESTRICT;
ALTER TABLE appts.secure_diagnostic_bundle ADD CONSTRAINT fk_secure_diag_bndl__integ_env_id__integ_env FOREIGN KEY (integrity_envelope_id) REFERENCES appts.integrity_envelope (integrity_envelope_id) ON DELETE RESTRICT;
ALTER TABLE appts.secure_diagnostic_bundle ADD CONSTRAINT fk_secure_diag_bndl__pred_bndl_id__secure_diag_bndl FOREIGN KEY (predecessor_bundle_id) REFERENCES appts.secure_diagnostic_bundle (diagnostic_bundle_id) ON DELETE RESTRICT;
ALTER TABLE appts.secure_diagnostic_bundle ADD CONSTRAINT fk_secure_diag_bndl__supersedes_bndl_id__secure_diag_bndl FOREIGN KEY (supersedes_bundle_id) REFERENCES appts.secure_diagnostic_bundle (diagnostic_bundle_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_bundle_member ADD CONSTRAINT fk_diag_bndl_member__diag_bndl_id__secure_diag_bndl FOREIGN KEY (diagnostic_bundle_id) REFERENCES appts.secure_diagnostic_bundle (diagnostic_bundle_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_bundle_member ADD CONSTRAINT fk_diagnostic_bundle_member__evidence_id__evidence_object FOREIGN KEY (evidence_id) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_dependency_evidence ADD CONSTRAINT fk_diag_dep_evid__error_evt_id__diag_error_evt FOREIGN KEY (error_event_id) REFERENCES appts.diagnostic_error_event (error_event_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_dependency_evidence ADD CONSTRAINT fk_diag_dep_evid__src_sys_ref_id__auth_src_ref FOREIGN KEY (source_system_ref_id) REFERENCES appts.authoritative_source_ref (source_system_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_dependency_evidence ADD CONSTRAINT fk_diag_dep_evid__adapter_prof_ref_id__adapter_prof_ref FOREIGN KEY (adapter_profile_ref_id) REFERENCES appts.adapter_profile_ref (adapter_profile_ref_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_dependency_evidence ADD CONSTRAINT fk_diag_dep_evid__timeout_evid_ref__evid_object FOREIGN KEY (timeout_evidence_ref) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_dependency_evidence ADD CONSTRAINT fk_diagnostic_dependency_evidence__evidence_id__evidence_object FOREIGN KEY (evidence_id) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_mapping_registry_version ADD CONSTRAINT fk_diag_map_reg_ver__config_snap_id__config_snap FOREIGN KEY (configuration_snapshot_id) REFERENCES appts.configuration_snapshot (configuration_snapshot_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_mapping_entry ADD CONSTRAINT fk_diag_map_entry__reg_ver_id__diag_map_reg_ver FOREIGN KEY (registry_version_id) REFERENCES appts.diagnostic_mapping_registry_version (registry_version_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_error_event ADD CONSTRAINT fk_diag_error_evt__config_snap_id__config_snap FOREIGN KEY (configuration_snapshot_id) REFERENCES appts.configuration_snapshot (configuration_snapshot_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_error_event ADD CONSTRAINT fk_diag_error_evt__map_entry_id__diag_map_entry FOREIGN KEY (mapping_entry_id) REFERENCES appts.diagnostic_mapping_entry (mapping_entry_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_error_event ADD CONSTRAINT fk_diag_error_evt__recon_case_id__recon_case FOREIGN KEY (reconciliation_case_id) REFERENCES appts.reconciliation_case (reconciliation_case_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_error_event ADD CONSTRAINT fk_diag_error_evt__integ_env_id__integ_env FOREIGN KEY (integrity_envelope_id) REFERENCES appts.integrity_envelope (integrity_envelope_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification ADD CONSTRAINT fk_diag_notif__error_evt_id__diag_error_evt FOREIGN KEY (error_event_id) REFERENCES appts.diagnostic_error_event (error_event_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification ADD CONSTRAINT fk_diag_notif__routing_config_snap_id__config_snap FOREIGN KEY (routing_configuration_snapshot_id) REFERENCES appts.configuration_snapshot (configuration_snapshot_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification ADD CONSTRAINT fk_diag_notif__sanit_payload_evid_id__evid_object FOREIGN KEY (sanitized_payload_evidence_id) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification ADD CONSTRAINT fk_diagnostic_notification__outbox_entry_id__outbox_entry FOREIGN KEY (outbox_entry_id) REFERENCES appts.outbox_entry (entry_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification ADD CONSTRAINT fk_diag_notif__agg_group_id__diag_agg_group FOREIGN KEY (aggregation_group_id) REFERENCES appts.diagnostic_aggregation_group (aggregation_group_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification ADD CONSTRAINT fk_diag_notif__fb_from_notif_id__diag_notif FOREIGN KEY (fallback_from_notification_id) REFERENCES appts.diagnostic_notification (notification_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_attempt ADD CONSTRAINT fk_diag_notif_att__notif_id__diag_notif FOREIGN KEY (notification_id) REFERENCES appts.diagnostic_notification (notification_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_attempt ADD CONSTRAINT fk_diag_notif_att__timeout_basis_config_snap_id__config_snap FOREIGN KEY (timeout_basis_configuration_snapshot_id) REFERENCES appts.configuration_snapshot (configuration_snapshot_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_attempt ADD CONSTRAINT fk_diag_notif_att__retry_of_att_id__diag_notif_att FOREIGN KEY (retry_of_attempt_id) REFERENCES appts.diagnostic_notification_attempt (notification_attempt_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_result ADD CONSTRAINT fk_diag_notif_res__notif_att_id__diag_notif_att FOREIGN KEY (notification_attempt_id) REFERENCES appts.diagnostic_notification_attempt (notification_attempt_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_result ADD CONSTRAINT fk_diagnostic_notification_result__evidence_id__evidence_object FOREIGN KEY (evidence_id) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_result ADD CONSTRAINT fk_diag_notif_res__routing_config_snap_id__config_snap FOREIGN KEY (routing_configuration_snapshot_id) REFERENCES appts.configuration_snapshot (configuration_snapshot_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_dead_letter ADD CONSTRAINT fk_diag_notif_dead_letter__notif_id__diag_notif FOREIGN KEY (notification_id) REFERENCES appts.diagnostic_notification (notification_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_dead_letter ADD CONSTRAINT fk_diag_notif_dead_letter__notif_att_id__diag_notif_att FOREIGN KEY (notification_attempt_id) REFERENCES appts.diagnostic_notification_attempt (notification_attempt_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_dead_letter ADD CONSTRAINT fk_diag_notif_dead_letter__notif_res_id__diag_notif_res FOREIGN KEY (notification_result_id) REFERENCES appts.diagnostic_notification_result (notification_result_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_acknowledgment ADD CONSTRAINT fk_diag_notif_ack__notif_id__diag_notif FOREIGN KEY (notification_id) REFERENCES appts.diagnostic_notification (notification_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_acknowledgment ADD CONSTRAINT fk_diag_notif_ack__notif_att_id__diag_notif_att FOREIGN KEY (notification_attempt_id) REFERENCES appts.diagnostic_notification_attempt (notification_attempt_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_acknowledgment ADD CONSTRAINT fk_diag_notif_ack__notif_res_id__diag_notif_res FOREIGN KEY (notification_result_id) REFERENCES appts.diagnostic_notification_result (notification_result_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_aggregation_group ADD CONSTRAINT fk_diag_agg_group__storm_ctl_config_snap_id__config_snap FOREIGN KEY (storm_control_configuration_snapshot_id) REFERENCES appts.configuration_snapshot (configuration_snapshot_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_aggregation_group ADD CONSTRAINT fk_diag_agg_group__curr_sum_evid_id__evid_object FOREIGN KEY (current_summary_evidence_id) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_aggregation_member ADD CONSTRAINT fk_diag_agg_member__agg_group_id__diag_agg_group FOREIGN KEY (aggregation_group_id) REFERENCES appts.diagnostic_aggregation_group (aggregation_group_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_aggregation_member ADD CONSTRAINT fk_diag_agg_member__error_evt_id__diag_error_evt FOREIGN KEY (error_event_id) REFERENCES appts.diagnostic_error_event (error_event_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_storm_control_decision ADD CONSTRAINT fk_diag_storm_ctl_dec__error_evt_id__diag_error_evt FOREIGN KEY (error_event_id) REFERENCES appts.diagnostic_error_event (error_event_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_storm_control_decision ADD CONSTRAINT fk_diag_storm_ctl_dec__agg_group_id__diag_agg_group FOREIGN KEY (aggregation_group_id) REFERENCES appts.diagnostic_aggregation_group (aggregation_group_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_storm_control_decision ADD CONSTRAINT fk_diag_storm_ctl_dec__config_snap_id__config_snap FOREIGN KEY (configuration_snapshot_id) REFERENCES appts.configuration_snapshot (configuration_snapshot_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_storm_control_decision ADD CONSTRAINT fk_diag_storm_ctl_dec__evid_id__evid_object FOREIGN KEY (evidence_id) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_failure_link ADD CONSTRAINT fk_diag_notif_fail_link__failed_notif_att_id__diag_notif_att FOREIGN KEY (failed_notification_attempt_id) REFERENCES appts.diagnostic_notification_attempt (notification_attempt_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_failure_link ADD CONSTRAINT fk_diag_notif_fail_link__parent_error_evt_id__diag_error_evt FOREIGN KEY (parent_error_event_id) REFERENCES appts.diagnostic_error_event (error_event_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_failure_link ADD CONSTRAINT fk_diag_notif_fail_link__child_error_evt_id__diag_error_evt FOREIGN KEY (child_error_event_id) REFERENCES appts.diagnostic_error_event (error_event_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_failure_link ADD CONSTRAINT fk_diag_notif_fail_link__root_error_evt_id__diag_error_evt FOREIGN KEY (root_error_event_id) REFERENCES appts.diagnostic_error_event (error_event_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_failure_link ADD CONSTRAINT fk_diag_notif_fail_link__storm_ctl_config_snap_id__config_snap FOREIGN KEY (storm_control_configuration_snapshot_id) REFERENCES appts.configuration_snapshot (configuration_snapshot_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_notification_failure_link ADD CONSTRAINT fk_diag_notif_fail_link__storm_ctl_dec_id__diag_storm_ctl_dec FOREIGN KEY (storm_control_decision_id) REFERENCES appts.diagnostic_storm_control_decision (storm_control_decision_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_event_correction ADD CONSTRAINT fk_diag_evt_corr__original_error_evt_id__diag_error_evt FOREIGN KEY (original_error_event_id) REFERENCES appts.diagnostic_error_event (error_event_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_event_correction ADD CONSTRAINT fk_diag_evt_corr__pred_bndl_id__secure_diag_bndl FOREIGN KEY (predecessor_bundle_id) REFERENCES appts.secure_diagnostic_bundle (diagnostic_bundle_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_event_correction ADD CONSTRAINT fk_diag_evt_corr__succ_bndl_id__secure_diag_bndl FOREIGN KEY (successor_bundle_id) REFERENCES appts.secure_diagnostic_bundle (diagnostic_bundle_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_event_correction ADD CONSTRAINT fk_diagnostic_event_correction__evidence_id__evidence_object FOREIGN KEY (evidence_id) REFERENCES appts.evidence_object (evidence_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_event_correction ADD CONSTRAINT fk_diag_evt_corr__pred_corr_id__diag_evt_corr FOREIGN KEY (predecessor_correction_id) REFERENCES appts.diagnostic_event_correction (diagnostic_event_correction_id) ON DELETE RESTRICT;
ALTER TABLE appts.secure_diagnostic_bundle ADD CONSTRAINT uq_secure_diagnostic_bundle__event_version UNIQUE (error_event_id, bundle_version);
ALTER TABLE appts.secure_diagnostic_bundle ADD CONSTRAINT uq_secure_diagnostic_bundle__bundle_event UNIQUE (diagnostic_bundle_id, error_event_id);
ALTER TABLE appts.diagnostic_notification ADD CONSTRAINT fk_diag_notif__bndl_evt__secure_diag_bndl FOREIGN KEY (diagnostic_bundle_id, error_event_id) REFERENCES appts.secure_diagnostic_bundle (diagnostic_bundle_id, error_event_id) ON DELETE RESTRICT;
ALTER TABLE appts.diagnostic_bundle_member ADD CONSTRAINT uq_diagnostic_bundle_member__bundle_evidence UNIQUE (diagnostic_bundle_id, evidence_id);
ALTER TABLE appts.diagnostic_bundle_member ADD CONSTRAINT uq_diagnostic_bundle_member__bundle_sequence UNIQUE (diagnostic_bundle_id, sequence_no);
ALTER TABLE appts.diagnostic_mapping_registry_version ADD CONSTRAINT uq_diagnostic_mapping_registry_version__identity_version UNIQUE (registry_identity, registry_version);
ALTER TABLE appts.diagnostic_mapping_entry ADD CONSTRAINT uq_diagnostic_mapping_entry__failure UNIQUE (registry_version_id, implementation_failure_identity);
ALTER TABLE appts.diagnostic_mapping_entry ADD CONSTRAINT uq_diagnostic_mapping_entry__code_failure UNIQUE (registry_version_id, canonical_error_code, implementation_failure_identity);
ALTER TABLE appts.diagnostic_notification ADD CONSTRAINT uq_diagnostic_notification__outbox UNIQUE (outbox_entry_id);
ALTER TABLE appts.diagnostic_notification_attempt ADD CONSTRAINT uq_diagnostic_notification_attempt__sequence UNIQUE (notification_id, attempt_sequence);
ALTER TABLE appts.diagnostic_notification_attempt ADD CONSTRAINT uq_diagnostic_notification_attempt__correlation UNIQUE (delivery_correlation_id);
ALTER TABLE appts.diagnostic_notification_dead_letter ADD CONSTRAINT uq_diagnostic_notification_dead_letter__result UNIQUE (notification_result_id);
ALTER TABLE appts.diagnostic_aggregation_member ADD CONSTRAINT uq_diagnostic_aggregation_member__group_event UNIQUE (aggregation_group_id, error_event_id);
ALTER TABLE appts.diagnostic_notification_failure_link ADD CONSTRAINT uq_diagnostic_notification_failure_link__attempt UNIQUE (failed_notification_attempt_id);
ALTER TABLE appts.diagnostic_notification_failure_link ADD CONSTRAINT uq_diagnostic_notification_failure_link__child UNIQUE (child_error_event_id);
CREATE UNIQUE INDEX uq_secure_diagnostic_bundle__current_event ON appts.secure_diagnostic_bundle (error_event_id) WHERE superseded_at IS NULL;
CREATE INDEX ix_diagnostic_error_event__correlation_time ON appts.diagnostic_error_event (correlation_id, occurred_at DESC);
CREATE INDEX ix_diagnostic_error_event__code_time ON appts.diagnostic_error_event (canonical_error_code, occurred_at DESC);
CREATE INDEX ix_diagnostic_error_event__component_severity_time ON appts.diagnostic_error_event (component_ref, severity_ref, occurred_at DESC);
CREATE INDEX ix_diagnostic_error_event__effect_time ON appts.diagnostic_error_event (diagnostic_effect_status, occurred_at DESC);
CREATE INDEX ix_diagnostic_error_event__mapping ON appts.diagnostic_error_event (mapping_entry_id);
CREATE INDEX ix_secure_diagnostic_bundle__event_created ON appts.secure_diagnostic_bundle (error_event_id, created_at DESC);
CREATE INDEX ix_diagnostic_bundle_member__evidence ON appts.diagnostic_bundle_member (evidence_id);
CREATE INDEX ix_diagnostic_dependency_evidence__event_dependency ON appts.diagnostic_dependency_evidence (error_event_id, dependency_ref, committed_at DESC);
CREATE INDEX ix_diagnostic_dependency_evidence__request ON appts.diagnostic_dependency_evidence (dependency_request_identity);
CREATE INDEX ix_diagnostic_mapping_entry__canonical_code ON appts.diagnostic_mapping_entry (registry_version_id, canonical_error_code);
CREATE INDEX ix_diagnostic_notification__event_channel_queue ON appts.diagnostic_notification (error_event_id, channel_class, queued_at DESC);
CREATE INDEX ix_diagnostic_notification__aggregation ON appts.diagnostic_notification (aggregation_group_id) WHERE aggregation_group_id IS NOT NULL;
CREATE INDEX ix_diagnostic_notification_attempt__notification_time ON appts.diagnostic_notification_attempt (notification_id, initiated_at DESC);
CREATE INDEX ix_diagnostic_notification_result__attempt_time ON appts.diagnostic_notification_result (notification_attempt_id, result_at DESC);
CREATE INDEX ix_diagnostic_notification_result__class_time ON appts.diagnostic_notification_result (delivery_result_class_ref, result_at DESC);
CREATE INDEX ix_diagnostic_notification_dead_letter__notification_time ON appts.diagnostic_notification_dead_letter (notification_id, recorded_at DESC);
CREATE INDEX ix_diagnostic_notification_ack__notification_time ON appts.diagnostic_notification_acknowledgment (notification_id, acknowledged_at DESC);
CREATE INDEX ix_diagnostic_notification_ack__correlation_time ON appts.diagnostic_notification_acknowledgment (correlation_id, acknowledged_at DESC);
CREATE INDEX ix_diagnostic_aggregation_group__fingerprint_profile_latest ON appts.diagnostic_aggregation_group (diagnostic_fingerprint, storm_control_configuration_snapshot_id, latest_seen_at DESC);
CREATE INDEX ix_diagnostic_aggregation_member__event ON appts.diagnostic_aggregation_member (error_event_id, included_at DESC);
CREATE INDEX ix_diagnostic_storm_control_decision__event_time ON appts.diagnostic_storm_control_decision (error_event_id, decided_at DESC);
CREATE INDEX ix_diagnostic_storm_control_decision__group_time ON appts.diagnostic_storm_control_decision (aggregation_group_id, decided_at DESC) WHERE aggregation_group_id IS NOT NULL;
CREATE INDEX ix_diagnostic_notification_failure_link__root_depth ON appts.diagnostic_notification_failure_link (root_error_event_id, recursion_depth);
CREATE INDEX ix_diagnostic_event_correction__event_commit ON appts.diagnostic_event_correction (original_error_event_id, committed_at DESC);
CREATE INDEX ix_diagnostic_event_correction__successor_bundle ON appts.diagnostic_event_correction (successor_bundle_id);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['diagnostic_error_event','diagnostic_event_subject','diagnostic_bundle_member','diagnostic_dependency_evidence','diagnostic_mapping_entry','diagnostic_notification','diagnostic_notification_attempt','diagnostic_notification_result','diagnostic_notification_dead_letter','diagnostic_notification_acknowledgment','diagnostic_aggregation_member','diagnostic_storm_control_decision','diagnostic_notification_failure_link','diagnostic_event_correction']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON appts.%I FOR EACH ROW EXECUTE FUNCTION appts.reject_canonical_mutation()',
      'trg_' || table_name || '__append_only', table_name
    );
  END LOOP;
END
$$;
