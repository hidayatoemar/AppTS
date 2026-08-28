import { useEffect, useMemo, useState } from "react";
import { createUiClient, type UiViewEnvelope } from "../api.ts";
import { CurrentnessBanner, type Currentness } from "../components/CurrentnessBanner.tsx";
import { ViewFrame } from "../components/ViewFrame.tsx";

type Row=Readonly<Record<string,unknown>>;
function ticketId():string|undefined{const match=/^\/tickets\/([^/]+)\/responsibility/.exec(location.pathname);if(!match?.[1])return undefined;try{return decodeURIComponent(match[1]);}catch{return undefined;}}
function record(value:unknown):Row{return typeof value==="object"&&value!==null?value as Row:{};}
function text(value:unknown):string|undefined{return typeof value==="string"&&value.length>0?value:undefined;}
function list(value:unknown):readonly Row[]{return Array.isArray(value)?value.map(record):[];}
function ref(value:unknown):string{return text(value)??"Not represented";}

export function ResponsibilityHandoverView(){
  const id=useMemo(ticketId,[]);const[projection,setProjection]=useState<UiViewEnvelope>();const[failure,setFailure]=useState<string>();
  useEffect(()=>{if(!id){setFailure("TICKET_ID_MISSING");return;}const client=createUiClient();void client.read(`/tickets/${encodeURIComponent(id)}/concerns/responsibility`).then((value)=>{if(value.view_id!=="UX-RS-06")throw new Error("RESPONSIBILITY_VIEW_MISMATCH");setProjection(value);}).catch((error:unknown)=>setFailure(error instanceof Error?error.message:"RESPONSIBILITY_PROJECTION_UNAVAILABLE"));},[id]);
  const d=projection?.data;const current=record(d?.["current_responsibility"]);const proposals=list(d?.["handover_proposals"]);const runtime=list(d?.["runtime_handover_context"]);const c=(projection?.currentness_ref??"MISSING_BINDING") as Currentness;const entityStatus=text(current["entity_binding_status"])??"UNBOUND";
  return <ViewFrame viewId="UX-RS-06" title="Responsibility and Handover"><CurrentnessBanner currentness={c}/>{failure?<p role="alert">{failure}</p>:null}{!projection?<p>Loading current responsibility projection.</p>:<section>
    <h3>Current accountability</h3>
    <p><strong>Responsible Role:</strong> {current["role_instance_ref"]?"One current Responsible Role is in force":"No current Responsible Role is represented"}</p>
    <p><strong>Entity boundary:</strong> {ref(current["entity_ref"])}</p>
    <p><strong>Current Holder:</strong> {ref(current["holder_ref"])}</p>
    <p><strong>Role Instance:</strong> {ref(current["role_instance_ref"])}</p>
    <p><strong>Assignment:</strong> {ref(current["assignment_ref"])}</p>
    <p><strong>Authority basis:</strong> {ref(current["authority_basis_ref"])}</p>
    <p data-entity-binding-status={entityStatus}><strong>Entity binding status:</strong> {entityStatus}</p>
    <p><strong>Responsibility status:</strong> {ref(current["status_ref"])}</p>
    <p>Supporting work, dependency handling, shared Incident correlation, and escalation do not by themselves transfer or merge Entity-scoped Ticket responsibility.</p>
    <details><summary>Traceable responsibility references</summary><p>Responsibility: {ref(current["responsibility_id"])}</p><p>Role instance: {ref(current["role_instance_ref"])}</p><p>Assignment snapshot: {ref(current["assignment_snapshot_ref"])}</p><p>Entity: {ref(current["entity_ref"])}</p><p>Assignment: {ref(current["assignment_ref"])}</p><p>Authority basis: {ref(current["authority_basis_ref"])}</p><p>Effective from: {ref(current["effective_from"])}</p></details>
    <h3>Governed handover</h3>
    {proposals.length===0?<p>No handover proposal is represented for this Ticket.</p>:<ul>{proposals.map((row,index)=><li key={text(row["handover_proposal_id"])??String(index)}><strong>{text(row["response_code"])??"Awaiting governed receiver response"}</strong> — responsibility remains with the current Entity-scoped Responsible Role unless a valid receiving acceptance completes the handover.<details><summary>Traceable handover references</summary><p>Proposal: {ref(row["handover_proposal_id"])}</p><p>Proposed receiver assignment: {ref(row["proposed_receiver_assignment_ref"])}</p><p>Receiver response: {ref(row["handover_response_id"])}</p><p>Response reason: {ref(row["response_reason_ref"])}</p><p>Responded at: {ref(row["responded_at"])}</p></details></li>)}</ul>}
    {runtime.length>0?<p><strong>Runtime handover currentness:</strong> {ref(runtime[0]?.["currentness_ref"])}</p>:null}
    {id?<nav aria-label="Ticket context"><a href={`/tickets/${encodeURIComponent(id)}/conditions`}>View waiting, blockers and dependencies</a> · <a href={`/tickets/${encodeURIComponent(id)}`}>Return to Ticket Console</a></nav>:null}
  </section>}</ViewFrame>;
}
