import assert from "node:assert/strict";
import test from "node:test";
import { ADMISSION_PREDICATES, appendTicketRelation, evaluateAdmission, formTicket, type PredicateResult } from "../../packages/core-d01/src/index.ts";
import { resolveAuthority, type AssignmentSnapshot, type AuthorityCandidate } from "../../packages/core-d02/src/index.ts";
import { evaluateGate, verifyEvidence } from "../../packages/core-d03/src/index.ts";
import { deriveAvailableActions, executeLifecycleEffect, type CommitOutcome, type DurableEffectResult, type RuntimeAggregate, type RuntimeEffectStore } from "../../packages/runtime-d04/src/index.ts";
import { MCR071_ENTITY_MATERIAL_INTENT_CARRIER_BOUND, resolveEntityActingCapacity } from "../../apps/api/src/projections/entity-axis-projection-port.ts";

const satisfied = (): PredicateResult[] => ADMISSION_PREDICATES.map((predicate) => ({ predicate, status: "SATISFIED" }));
const binding = { purposeBindingId: "PB-RESTORE", purposeIdentity: "RESTORE_SERVICE", purposeVersion: "1.0.0", packageIdentity: "APP-RESTORE-SERVICE", packageVersion: "1.0.0", coreBindingRef: "CORE", hookBindingRef: "HOOK" };
const assignment = (entityRef:string, assignmentRef:string, state:AssignmentSnapshot["state"]="CURRENT"):AssignmentSnapshot => ({ snapshotId:`SNAP-${entityRef}-${assignmentRef}`, roleRef:"LOGICAL-ROLE-RESTORE", roleInstanceRef:`ROLE-INSTANCE-${entityRef}`, holderRef:"HOLDER-H", assignmentRef, entityRef, domainId:"DOMAIN-RESTORE", authorityBasisRef:`AUTH-BASIS-${entityRef}`, effectiveFrom:"2026-08-28T00:00:00Z", state, sourceRef:"SYNTHETIC-MCR071" });
const candidate = (entityRef:string, assignmentRef:string, state:AssignmentSnapshot["state"]="CURRENT", evidenceSatisfied=true):AuthorityCandidate => ({ responsibilityId:`RESP-${entityRef}-${assignmentRef}`, snapshot:assignment(entityRef,assignmentRef,state), scopeMatches:true, ticketContextMatches:true, evidenceSatisfied, sodSatisfied:true, policySatisfied:true, actions:[{action_class_ref:"RESTORE",permission_code:"ALLOW"}] });
const authorityInput = (entityRef:string, assignmentRef:string, candidates:readonly AuthorityCandidate[]) => ({ resultId:`AUTH-${entityRef}`, ticketId:`TICKET-${entityRef}`, entityRef, domainId:"DOMAIN-RESTORE", actorHolderRef:"HOLDER-H", actingRoleInstanceRef:`ROLE-INSTANCE-${entityRef}`, actingAssignmentRef:assignmentRef, authorityBasisRef:`AUTH-BASIS-${entityRef}`, contextRef:"SYNTHETIC-CONTEXT", currentnessRef:"CURRENT", effectiveFrom:"2026-08-28T00:00:00Z", candidates });

class Store implements RuntimeEffectStore {
  aggregate:RuntimeAggregate;
  results=new Map<string,DurableEffectResult>();
  constructor(entityRef:string){this.aggregate={ticketId:"TICKET-ENTITY-A",entityRef,state:"ACCEPTED",aggregateVersion:0,purposeBindingId:"PB-RESTORE",purposeIdentity:"RESTORE_SERVICE",purposeVersion:"1.0.0",packageIdentity:"APP-RESTORE-SERVICE",packageVersion:"1.0.0",activationId:"ACT-A"};}
  async loadAggregate(){return this.aggregate;}
  async findCommandResult(id:string){return this.results.get(id);}
  async commitEffect(expected:number,next:RuntimeAggregate,result:DurableEffectResult):Promise<CommitOutcome>{if(this.aggregate.aggregateVersion!==expected)return{status:"VERSION_CONFLICT"};this.aggregate=next;this.results.set(result.commandId,result);return{status:"COMMITTED",result};}
}

const effectCommand=(entityRef:string)=>({commandId:`CMD-${entityRef}`,payloadHash:`HASH-${entityRef}`,ticketId:"TICKET-ENTITY-A",entityRef,actorHolderRef:"HOLDER-H",actingRoleInstanceRef:`ROLE-INSTANCE-${entityRef}`,actingAssignmentRef:`ASSIGNMENT-${entityRef}`,authorityBasisRef:`AUTH-BASIS-${entityRef}`,expectedAggregateVersion:0,actionClass:"RESTORE",targetState:"ACTIVE" as const,availableActions:["RESTORE"],currentness:"CURRENT" as const});

test("MCR071-A same Purpose + same Logical Domain + different Entity remains distinct",()=>{
  const assessment=evaluateAdmission("ASSESS","CASE",satisfied());
  const a=formTicket(assessment,{formationId:"FORM-A",ticketId:"TICKET-A",entityRef:"ENTITY-A",domainId:"DOMAIN-RESTORE",intakeDecisionId:"DEC-A",responsibleAssignmentRef:"ASSIGNMENT-A",formationEvidenceSetRef:"EVID-A",aggregateVersion:0,effectiveAt:"2026-08-28T00:00:00Z",binding});
  const b=formTicket(assessment,{formationId:"FORM-B",ticketId:"TICKET-B",entityRef:"ENTITY-B",domainId:"DOMAIN-RESTORE",intakeDecisionId:"DEC-B",responsibleAssignmentRef:"ASSIGNMENT-B",formationEvidenceSetRef:"EVID-B",aggregateVersion:0,effectiveAt:"2026-08-28T00:00:00Z",binding});
  assert.equal(a.activation.purpose_binding_id,b.activation.purpose_binding_id);assert.equal(a.activation.domain_id,b.activation.domain_id);assert.notEqual(a.activation.entity_ref,b.activation.entity_ref);
});

test("MCR071-B same Holder with multiple Entity Assignments does not bleed authority",()=>{
  const a=candidate("ENTITY-A","ASSIGNMENT-A");const b=candidate("ENTITY-B","ASSIGNMENT-B");
  const resolved=resolveAuthority(authorityInput("ENTITY-A","ASSIGNMENT-A",[a,b]));
  const wrong=resolveAuthority(authorityInput("ENTITY-B","ASSIGNMENT-A",[a,b]));
  assert.equal(resolved.result_status_ref,"AUTHORIZED");assert.equal(resolved.entity_ref,"ENTITY-A");assert.equal(wrong.result_status_ref,"NO_VALID_AUTHORITY");
});

test("MCR071-C wrong-Entity material action fails closed with no durable effect",async()=>{
  const store=new Store("ENTITY-A");const result=await executeLifecycleEffect(store,effectCommand("ENTITY-B"));
  assert.equal(result.disposition,"NO_EFFECT");assert.equal(result.reason,"WRONG_ENTITY_NO_EFFECT");assert.equal(store.aggregate.aggregateVersion,0);assert.equal(store.results.size,0);
});

test("MCR071-D correct Entity is necessary but not sufficient",()=>{
  const noEvidence=resolveAuthority(authorityInput("ENTITY-A","ASSIGNMENT-A",[candidate("ENTITY-A","ASSIGNMENT-A","CURRENT",false)]));
  assert.equal(noEvidence.result_status_ref,"NO_VALID_AUTHORITY");
  const verification=verifyEvidence({requestId:"VR",evidenceSetVersionRef:"SET",requesterRef:"REQ",verifierRef:"VER",independentRequired:true},true,"VERIFIED");
  const gate=evaluateGate({gateResultId:"G",ticketId:"TICKET-A",entityRef:"ENTITY-A",gateIdentity:"GATE",evaluationId:"GE",actorHolderRef:"HOLDER-H",actingRoleInstanceRef:"ROLE-INSTANCE-ENTITY-A",actingAssignmentRef:"ASSIGNMENT-A",authorityBasisRef:"AUTH-BASIS-ENTITY-A",inputVersionSetRef:"V",currentnessRef:"CURRENT",effectiveFrom:"2026-08-28T00:00:00Z",predicates:[{identity:"POLICY",status:"FAILED"}],verification,requestedProgressionClasses:["RESTORE"]});
  assert.deepEqual(gate.permitted_progression_classes,[]);
});

test("MCR071-E Assignment lifecycle remains independent",()=>{
  const current=resolveAuthority(authorityInput("ENTITY-A","ASSIGNMENT-A",[candidate("ENTITY-A","ASSIGNMENT-A","CURRENT")]));
  const stale=resolveAuthority(authorityInput("ENTITY-A","ASSIGNMENT-A",[candidate("ENTITY-A","ASSIGNMENT-A","STALE")]));
  assert.equal(current.result_status_ref,"AUTHORIZED");assert.equal(stale.result_status_ref,"NO_VALID_AUTHORITY");assert.equal(current.actor_holder_ref,"HOLDER-H");
});

test("MCR071-F audit/effect attribution includes Entity Role Instance Assignment basis",async()=>{
  const store=new Store("ENTITY-A");const result=await executeLifecycleEffect(store,effectCommand("ENTITY-A"));
  assert.equal(result.disposition,"EFFECT_APPLIED");assert.equal(result.entityRef,"ENTITY-A");assert.equal(result.actorHolderRef,"HOLDER-H");assert.equal(result.actingRoleInstanceRef,"ROLE-INSTANCE-ENTITY-A");assert.equal(result.actingAssignmentRef,"ASSIGNMENT-ENTITY-A");assert.equal(result.authorityBasisRef,"AUTH-BASIS-ENTITY-A");assert.equal(result.auditRef,"audit:CMD-ENTITY-A");
});

test("MCR071-G shared Incident correlation does not merge Entity governance",()=>{
  const a=appendTicketRelation({ticketId:"TICKET-A",entityRef:"ENTITY-A",state:"ACTIVE",relations:[]},{relationId:"INCIDENT-CORR",fromTicketId:"TICKET-A",fromEntityRef:"ENTITY-A",toTicketId:"TICKET-B",toEntityRef:"ENTITY-B",kind:"RELATED"});
  assert.equal(a.entityRef,"ENTITY-A");assert.equal(a.relations[0]!.toEntityRef,"ENTITY-B");
  assert.throws(()=>appendTicketRelation({ticketId:"TICKET-A",entityRef:"ENTITY-A",state:"ACTIVE",relations:[]},{relationId:"BAD",fromTicketId:"TICKET-A",fromEntityRef:"ENTITY-B",toTicketId:"TICKET-B",toEntityRef:"ENTITY-B",kind:"RELATED"}),/RELATION_SOURCE_ENTITY_MISMATCH/);
});

test("MCR071-H human-facing acting Entity Role Assignment capacity is explicit before material commit",()=>{
  const capacity=resolveEntityActingCapacity({ticket_entity_ref:"ENTITY-A",authority_entity_ref:"ENTITY-A",acting_holder_ref:"HOLDER-H",acting_role_instance_ref:"ROLE-INSTANCE-A",acting_assignment_ref:"ASSIGNMENT-A",authority_basis_ref:"AUTH-BASIS-A",responsibility_entity_ref:"ENTITY-A",responsibility_role_instance_ref:"ROLE-INSTANCE-A",responsibility_holder_ref:"HOLDER-H",assignment_entity_ref:"ENTITY-A",assignment_role_instance_ref:"ROLE-INSTANCE-A",assignment_holder_ref:"HOLDER-H",assignment_ref:"ASSIGNMENT-A",assignment_authority_basis_ref:"AUTH-BASIS-A"});
  assert.deepEqual(capacity,{status:"BOUND",reason_ref:"ENTITY_AUTHORITY_CONTEXT_EXPLICIT",entity_ref:"ENTITY-A",holder_ref:"HOLDER-H",role_instance_ref:"ROLE-INSTANCE-A",assignment_ref:"ASSIGNMENT-A",authority_basis_ref:"AUTH-BASIS-A"});
  assert.equal(resolveEntityActingCapacity({ticket_entity_ref:"ENTITY-A"}).status,"UNBOUND");
  assert.equal(MCR071_ENTITY_MATERIAL_INTENT_CARRIER_BOUND,false);
});

test("MCR071 authority/gate action derivation requires identical Entity attribution",()=>{
  const authority=resolveAuthority(authorityInput("ENTITY-A","ASSIGNMENT-A",[candidate("ENTITY-A","ASSIGNMENT-A")]));
  const verification=verifyEvidence({requestId:"V3",evidenceSetVersionRef:"SET3",requesterRef:"REQ",verifierRef:"VER",independentRequired:true},true,"VERIFIED");
  const gate=evaluateGate({gateResultId:"G3",ticketId:"TICKET-ENTITY-A",entityRef:"ENTITY-B",gateIdentity:"GATE",evaluationId:"GE3",actorHolderRef:"HOLDER-H",actingRoleInstanceRef:"ROLE-INSTANCE-ENTITY-B",actingAssignmentRef:"ASSIGNMENT-B",authorityBasisRef:"AUTH-BASIS-ENTITY-B",inputVersionSetRef:"V3",currentnessRef:"CURRENT",effectiveFrom:"2026-08-28T00:00:00Z",predicates:[{identity:"ALL",status:"SATISFIED"}],verification,requestedProgressionClasses:["RESTORE"]});
  assert.deepEqual(deriveAvailableActions(authority,gate,[]),[]);
});
