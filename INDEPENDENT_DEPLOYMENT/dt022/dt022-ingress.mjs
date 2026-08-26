import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createPersistencePool } from '../../DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/packages/persistence/dist/index.js';
import { createTlsDay1GoldenDispatcher, TLS_DAY1_GOLDEN_CONTEXT } from '../../DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/dist/trial/tls-day1-golden-flow.js';
import { establishArc011AiVerificationBindings, ARC011_AI_VERIFICATION_CONTEXT, ARC011_AI_VERIFICATION_MAPPING_PROFILE } from '../../DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/dist/trial/arc011-ai-verification-context.js';
import { persistQualifiedExternalRecord } from '../../DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/dist/runtime/d05-qualified-external-record-ingress.js';
import { applyQualifiedExternalDependency } from '../../DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/dist/runtime/d04-external-dependency-owner.js';

const databaseUrl=process.env.DATABASE_URL;
const disclosureLabelRef=process.env.APPTS_TRIAL_DISCLOSURE_LABEL_REF;
const evidenceDir=process.env.DT022_EVIDENCE_DIR;
assert.ok(databaseUrl);assert.ok(disclosureLabelRef);assert.ok(evidenceDir);
const pool=createPersistencePool({connectionString:databaseUrl});
const fallback=Object.freeze({async dispatch(){throw new Error('DT022_FALLBACK_DISPATCH_NOT_EXPECTED');},async capture(){throw new Error('DT022_FALLBACK_CAPTURE_NOT_EXPECTED');}});
try{
  const day1=createTlsDay1GoldenDispatcher(pool,fallback);
  const formed=await day1.dispatch('APPTS.CORE.D01.PRETICKET_ADMISSION.SUBMISSION / 1.0.0',{messageId:randomUUID(),idempotencyKey:randomUUID(),correlationId:randomUUID(),trialContext:TLS_DAY1_GOLDEN_CONTEXT});
  assert.equal(formed?.disposition,'CREATED');assert.equal(typeof formed.ticketId,'string');
  const ticketId=formed.ticketId;
  const bindings=await establishArc011AiVerificationBindings(pool,ticketId,disclosureLabelRef);
  const at=new Date().toISOString();const qerId=randomUUID();
  const payload=Object.freeze({verification_context:ARC011_AI_VERIFICATION_CONTEXT,dt_scenario:'MCR-to-DT-022-TRANSPORT-NEUTRAL-INDEPENDENT',synthetic:true,non_production:true,non_factual:true,source_event:'EXTERNAL_WAITING',external_subject_ref:bindings.externalSubjectRef,harness_supplies_external_world_stimulus_only:true,app_truth_written_by:'ACCEPTED_PRODUCT_D05_TO_D04_RUNTIME_PATH'});
  const record=Object.freeze({qualified_external_record_id:qerId,source_system_ref_id:bindings.sourceSystemRefId,adapter_profile_ref_id:bindings.adapterProfileRefId,external_record_identity:`DT022-EXT-WAIT-${randomUUID()}`,external_record_version_ref:'1',subject_ref:bindings.externalSubjectRef,qualification_result_ref:'QUALIFIED',source_time:at,received_at:at,payload_or_reference_ref:payload,payload_hash:createHash('sha256').update(JSON.stringify(payload)).digest('hex'),currentness_ref:'CURRENT'});
  const d05=await persistQualifiedExternalRecord(pool,record,{disclosureLabelRef,payloadJsonSchemaVersionRef:'DT022_ARC011_SYNTHETIC_V1'});assert.equal(d05.disposition,'QUALIFIED_PERSISTED');
  const mapping=Object.freeze({mappingProfileRef:ARC011_AI_VERIFICATION_MAPPING_PROFILE,ticketId,dependencyTypeRef:'EXTERNAL_DEPENDENCY',dependencyStatusRef:'EXTERNAL_WAITING',responsibilityId:bindings.responsibilityId,obligationOwnerRef:bindings.supportingAssignmentRef,blockerOwnerRef:bindings.supportingAssignmentRef,nextControlOwnerRef:bindings.supportingAssignmentRef,blockedWorkRef:bindings.blockedWorkRef,waitingReasonRef:'EXTERNAL_WAITING',blockerReasonRef:'UNRESOLVED_DEPENDENCY',obligationClassRef:'DEPENDENCY_RESOLUTION',nextControlClassRef:'DEPENDENCY_REVIEW',dueBasisRef:'MCR_TO_DT_022_SYNTHETIC_TRIGGER_ONLY',dueAt:at,nextEvaluationAt:at,escalation:Object.freeze({sourceEscalationObligationRef:bindings.escalationObligationRef,routeRefCode:bindings.escalationRouteRefCode,interventionDueBasisRef:'MCR_TO_DT_022_SYNTHETIC_TRIGGER_ONLY'})});
  const d04=await applyQualifiedExternalDependency(pool,d05.record,mapping);assert.equal(d04.disposition,'APPLIED');assert.equal(d04.responsibilityTransferred,false);
  const d05Replay=await persistQualifiedExternalRecord(pool,record,{disclosureLabelRef,payloadJsonSchemaVersionRef:'DT022_ARC011_SYNTHETIC_V1'});assert.equal(d05Replay.disposition,'IDEMPOTENT_REPLAY');
  const d04Replay=await applyQualifiedExternalDependency(pool,d05Replay.record,mapping);assert.equal(d04Replay.disposition,'IDEMPOTENT_REPLAY');assert.deepEqual(d04Replay.refs,d04.refs);

  const staleId=randomUUID();const stalePayload=Object.freeze({...payload,dt_scenario:'MCR-to-DT-022-STALE-CURRENTNESS-NEGATIVE'});
  const staleRecord=Object.freeze({...record,qualified_external_record_id:staleId,external_record_identity:`DT022-STALE-${randomUUID()}`,external_record_version_ref:'0',payload_or_reference_ref:stalePayload,payload_hash:createHash('sha256').update(JSON.stringify(stalePayload)).digest('hex'),currentness_ref:'STALE'});
  const staleD05=await persistQualifiedExternalRecord(pool,staleRecord,{disclosureLabelRef,payloadJsonSchemaVersionRef:'DT022_ARC011_SYNTHETIC_V1'});
  let staleApply='NOT_ATTEMPTED';
  if(staleD05.disposition==='QUALIFIED_PERSISTED'){
    try{await applyQualifiedExternalDependency(pool,staleD05.record,mapping);throw new Error('STALE_RECORD_UNEXPECTEDLY_APPLIED');}
    catch(error){const message=error instanceof Error?error.message:String(error);assert.equal(message,'INT_RUN_TD_01_NOT_CURRENT');staleApply='FAIL_CLOSED_INT_RUN_TD_01_NOT_CURRENT';}
  }else{assert.equal(staleD05.disposition,'NO_EFFECT');staleApply=`D05_${staleD05.reason}`;}

  const counts=await pool.query(`SELECT
    (SELECT count(*)::int FROM appts.qualified_external_record WHERE qualified_external_record_id=$1) AS qer_count,
    (SELECT count(*)::int FROM appts.dependency_context WHERE ticket_id=$2 AND evidence_ref=$1 AND dependency_status_ref='EXTERNAL_WAITING') AS dependency_count,
    (SELECT count(*)::int FROM appts.operational_obligation WHERE ticket_id=$2 AND source_ref=$1 AND status_ref='OPEN') AS obligation_count,
    (SELECT count(*)::int FROM appts.runtime_blocker WHERE ticket_id=$2 AND evidence_ref=$1 AND cleared_at IS NULL AND status_ref='OPEN') AS blocker_count,
    (SELECT count(*)::int FROM appts.waiting_interval WHERE ticket_id=$2 AND ended_at IS NULL) AS waiting_count,
    (SELECT count(*)::int FROM appts.residual_obligation WHERE ticket_id=$2 AND evidence_ref=$1 AND disposition_status_ref='OPEN') AS residual_count,
    (SELECT count(*)::int FROM appts.next_control WHERE ticket_id=$2 AND source_obligation_ref=$3) AS next_control_count,
    (SELECT count(*)::int FROM appts.runtime_escalation WHERE ticket_id=$2 AND evidence_ref=$1 AND status_ref='OPEN') AS escalation_count,
    (SELECT count(*)::int FROM appts.responsibility_change WHERE ticket_id=$2) AS responsibility_change_count,
    (SELECT aggregate_version::int FROM appts.runtime_ticket WHERE ticket_id=$2) AS aggregate_version,
    (SELECT current_state_code FROM appts.runtime_ticket WHERE ticket_id=$2) AS lifecycle_state,
    (SELECT count(*)::int FROM appts.dependency_context WHERE evidence_ref=$4) AS stale_dependency_count,
    (SELECT count(*)::int FROM appts.runtime_blocker WHERE evidence_ref=$4) AS stale_blocker_count`,[qerId,ticketId,d04.refs.obligationId,staleId]);
  const durable=counts.rows[0];for(const key of ['qer_count','dependency_count','obligation_count','blocker_count','waiting_count','residual_count','next_control_count','escalation_count'])assert.equal(durable[key],1,key);
  assert.equal(durable.responsibility_change_count,0);assert.equal(durable.aggregate_version,0);assert.equal(durable.lifecycle_state,'ACCEPTED');assert.equal(durable.stale_dependency_count,0);assert.equal(durable.stale_blocker_count,0);
  const provenance=await pool.query(`SELECT q.qualified_external_record_id::text AS qer_id,q.external_record_identity,q.external_record_version_ref,q.currentness_ref,q.payload_hash,s.source_identity,s.source_version_or_profile_ref,a.adapter_profile_identity,a.adapter_profile_version::text AS adapter_profile_version FROM appts.qualified_external_record q JOIN appts.authoritative_source_ref s ON s.source_system_ref_id=q.source_system_ref_id JOIN appts.adapter_profile_ref a ON a.adapter_profile_ref_id=$2 WHERE q.qualified_external_record_id=$1`,[qerId,bindings.adapterProfileRefId]);
  assert.equal(provenance.rowCount,1);assert.equal(provenance.rows[0].currentness_ref,'CURRENT');
  const out={classification:'D2',authority:'MCR-to-DT-022',invocation_method:'DT-only synthetic stimulus -> accepted Product D05 -> accepted Product D04',ticket_id:ticketId,qer_id:qerId,stale_qer_id:staleId,d05:d05.disposition,d04:d04.disposition,replay:d04Replay.disposition,stale_d05:staleD05.disposition,stale_apply:staleApply,responsibility_transferred:false,lifecycle_state:durable.lifecycle_state,aggregate_version:durable.aggregate_version,durable_counts:durable,provenance:provenance.rows[0],product_refs:d04.refs};
  writeFileSync(`${evidenceDir}/ticket-id.txt`,ticketId+'\n');writeFileSync(`${evidenceDir}/qer-id.txt`,qerId+'\n');process.stdout.write(JSON.stringify(out,null,2)+'\n');
}finally{await pool.end();}
