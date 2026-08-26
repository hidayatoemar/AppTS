import { useEffect, useMemo, useState } from "react";
import { createUiClient, type UiViewEnvelope } from "../api.ts";
import { CurrentnessBanner, type Currentness } from "../components/CurrentnessBanner.tsx";
import { ViewFrame } from "../components/ViewFrame.tsx";

type Row=Readonly<Record<string,unknown>>;
function ticketId():string|undefined{const match=/^\/tickets\/([^/]+)\/conditions/.exec(location.pathname);if(!match?.[1])return undefined;try{return decodeURIComponent(match[1]);}catch{return undefined;}}
function record(value:unknown):Row{return typeof value==="object"&&value!==null?value as Row:{};}
function text(value:unknown):string|undefined{return typeof value==="string"&&value.length>0?value:undefined;}
function list(value:unknown):readonly Row[]{return Array.isArray(value)?value.map(record):[];}
function ref(value:unknown):string{return text(value)??"Not represented";}
function count(value:readonly unknown[]):string{return String(value.length);}
function age(value:unknown):string{if(typeof value!=="number"||!Number.isFinite(value))return"Age unavailable";const seconds=Math.max(0,Math.floor(value));if(seconds<60)return`${seconds}s`;const minutes=Math.floor(seconds/60);if(minutes<60)return`${minutes}m`;const hours=Math.floor(minutes/60);if(hours<48)return`${hours}h`;return`${Math.floor(hours/24)}d`;}

export function WaitingBlockerDependencyView(){
  const id=useMemo(ticketId,[]);const[projection,setProjection]=useState<UiViewEnvelope>();const[failure,setFailure]=useState<string>();
  useEffect(()=>{if(!id){setFailure("TICKET_ID_MISSING");return;}const client=createUiClient();void client.read(`/tickets/${encodeURIComponent(id)}/concerns/conditions`).then((value)=>{if(value.view_id!=="UX-RS-07")throw new Error("CONDITIONS_VIEW_MISMATCH");setProjection(value);}).catch((error:unknown)=>setFailure(error instanceof Error?error.message:"CONDITIONS_PROJECTION_UNAVAILABLE"));},[id]);
  const d=projection?.data;const waiting=list(d?.["open_waiting"]);const blockers=list(d?.["open_blockers"]);const dependencies=list(d?.["dependencies"]);const obligations=list(d?.["operational_obligations"]);const controls=list(d?.["next_controls"]);const escalations=list(d?.["escalations"]);const impact=record(d?.["closure_impact"]);const c=(projection?.currentness_ref??"MISSING_BINDING") as Currentness;
  return <ViewFrame viewId="UX-RS-07" title="Waiting / Blocker / Dependency"><CurrentnessBanner currentness={c}/>{failure?<p role="alert">{failure}</p>:null}{!projection?<p>Loading current operational conditions.</p>:<section>
    <h3>Operational attention</h3>
    <p><strong>Open waiting:</strong> {count(waiting)} · <strong>Open blockers:</strong> {count(blockers)} · <strong>Represented dependencies:</strong> {count(dependencies)}</p>
    <p>Waiting and blockers are operational conditions; they are not Ticket lifecycle states.</p>
    <h3>What is being waited for</h3>
    {waiting.length===0?<p>No open waiting interval is represented.</p>:<ul>{waiting.map((row,index)=><li key={text(row["waiting_id"])??String(index)}><strong>{text(row["waiting_reason_ref_code"])??"Governed waiting condition"}</strong> — owner {ref(row["responsible_owner_ref"])}; {age(row["derived_age_seconds"])}.<details><summary>Traceable waiting references</summary><p>Waiting: {ref(row["waiting_id"])}</p><p>Dependency: {ref(row["dependency_context_id"])}</p><p>Expected obligation: {ref(row["expected_obligation_ref"])}</p><p>Started: {ref(row["started_at"])}</p></details></li>)}</ul>}
    <h3>What is blocking progress</h3>
    {blockers.length===0?<p>No open blocker is represented.</p>:<ul>{blockers.map((row,index)=><li key={text(row["blocker_id"])??String(index)}><strong>{ref(row["blocker_reason_ref"])}</strong> — owner {ref(row["owner_ref"])}; {age(row["derived_age_seconds"])}. {text(row["downstream_impact_ref"])?<>Downstream impact is explicitly represented.</>:null}<details><summary>Traceable blocker references</summary><p>Blocker: {ref(row["blocker_id"])}</p><p>Blocked work: {ref(row["blocked_work_ref"])}</p><p>Unmet dependency: {ref(row["unmet_dependency_ref"])}</p><p>Evidence: {ref(row["evidence_ref"])}</p></details></li>)}</ul>}
    <h3>Dependencies</h3>
    {dependencies.length===0?<p>No dependency projection is represented.</p>:<ul>{dependencies.map((row,index)=><li key={text(row["dependency_context_id"])??String(index)}><strong>{ref(row["dependency_type_ref"])}</strong> — status {ref(row["dependency_status_ref"])}{typeof row["derived_age_seconds"]==="number"?`; waiting ${age(row["derived_age_seconds"])}`:""}.<details><summary>Traceable dependency references</summary><p>Dependency: {ref(row["dependency_context_id"])}</p><p>Subject: {ref(row["external_or_internal_subject_ref"])}</p><p>Source version: {ref(row["source_version_ref"])}</p><p>Evidence: {ref(row["evidence_ref"])}</p></details></li>)}</ul>}
    <h3>Next governed control</h3>
    {controls.length===0?<p>No current next-control record is represented for this Ticket version.</p>:<ul>{controls.map((row,index)=><li key={text(row["next_control_id"])??String(index)}>The server derives the next control for owner/responsibility <strong>{ref(row["owner_or_responsibility_ref"])}</strong>.<details><summary>Technical control reference</summary><p>Control class: {ref(row["control_class_ref"])}</p><p>Source obligation: {ref(row["source_obligation_ref"])}</p><p>Due basis: {ref(row["due_basis_ref"])}</p><p>Currentness: {ref(row["currentness_ref"])}</p></details></li>)}</ul>}
    <h3>Escalation</h3>
    {escalations.length===0?<p>No governed escalation is represented.</p>:<ul>{escalations.map((row,index)=><li key={text(row["runtime_escalation_id"])??String(index)}><strong>Status:</strong> {ref(row["status_ref"])}. Escalation adds intervention duty; it does not transfer Ticket responsibility.<details><summary>Traceable escalation references</summary><p>Reason: {ref(row["created_reason_ref"])}</p><p>Escalation Role: {ref(row["escalation_role_ref"])}</p><p>Intervention result: {ref(row["intervention_result_ref"])}</p><p>Successor escalation: {ref(row["successor_escalation_id"])}</p></details></li>)}</ul>}
    {obligations.length>0?<p><strong>Operational obligations represented:</strong> {count(obligations)}. Their canonical status remains server-owned.</p>:null}
    <h3>Closure impact</h3>
    <p>{impact["open_condition_present"]===true?"Closure remains withheld while an open waiting or blocker condition remains unresolved or undispositioned.":"No open waiting or blocker is observed by this view. This is not, by itself, a closure-readiness decision."}</p>
    {id?<nav aria-label="Ticket context"><a href={`/tickets/${encodeURIComponent(id)}/responsibility`}>View responsibility and handover</a> · <a href={`/tickets/${encodeURIComponent(id)}`}>Return to Ticket Console</a></nav>:null}
  </section>}</ViewFrame>;
}
