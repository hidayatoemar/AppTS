import { useEffect, useState } from "react";
import { createUiClient, type UiViewEnvelope } from "../api.ts";
import { CurrentnessBanner, type Currentness } from "../components/CurrentnessBanner.tsx";
import { ViewFrame } from "../components/ViewFrame.tsx";

type TicketProjection = Readonly<{
  ticket_id?: unknown;
  current_state_code?: unknown;
  aggregate_version?: unknown;
  currentness_ref?: unknown;
}>;

const currentnessValues = new Set<Currentness>(["CURRENT", "STALE", "CONTRADICTORY", "MIXED_SOURCE", "MISSING_BINDING", "UNCERTAIN"]);
function currentness(value: unknown): Currentness { return typeof value === "string" && currentnessValues.has(value as Currentness) ? value as Currentness : "MISSING_BINDING"; }
function text(value: unknown): string { return typeof value === "string" && value.length > 0 ? value : "Not available from current source"; }

export function WorkQueueView() {
  const [projection, setProjection] = useState<UiViewEnvelope>();
  const [failure, setFailure] = useState<string>();
  useEffect(() => {
    const client = createUiClient();
    void client.read("/work-queue").then((result) => {
      if (result.view_id !== "UX-RS-01") throw new Error("WORK_QUEUE_PROJECTION_VIEW_MISMATCH");
      setProjection(result);
    }).catch((error: unknown) => setFailure(error instanceof Error ? error.message : "WORK_QUEUE_PROJECTION_UNAVAILABLE"));
  }, []);

  const rawTickets = projection?.data["tickets"];
  const tickets = Array.isArray(rawTickets) ? rawTickets.filter((item): item is TicketProjection => typeof item === "object" && item !== null) : [];
  const projectionCurrentness = currentness(projection?.currentness_ref);

  return <ViewFrame viewId="UX-RS-01" title="Role-Scoped Work Queue">
    <CurrentnessBanner currentness={projectionCurrentness} />
    {failure ? <p role="alert">{failure}: current work-queue projection is unavailable.</p> : null}
    <p>Current server projection: {tickets.length} runtime Ticket{tickets.length === 1 ? "" : "s"}.</p>
    {tickets.length === 0 ? <p>No runtime Tickets are currently projected.</p> : <ul>{tickets.map((ticket, index) => <li key={text(ticket.ticket_id) === "Not available from current source" ? String(index) : text(ticket.ticket_id)}>
      <strong>{text(ticket.ticket_id)}</strong> — {text(ticket.current_state_code)} — aggregate version {String(ticket.aggregate_version ?? "unknown")} — {text(ticket.currentness_ref)}
    </li>)}</ul>}
    <p><a href="/intake">Open pre-Ticket intake</a></p>
  </ViewFrame>;
}
