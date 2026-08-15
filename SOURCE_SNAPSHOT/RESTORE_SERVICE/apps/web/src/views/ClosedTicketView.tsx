import { useEffect, useMemo, useState } from "react";
import { createUiClient, type UiViewEnvelope } from "../api.ts";
import { ActionControl, type ActionPresentation } from "../components/ActionControl.tsx";
import { CurrentnessBanner, type Currentness } from "../components/CurrentnessBanner.tsx";
import { ViewFrame } from "../components/ViewFrame.tsx";
import { navigate } from "../router.ts";

type ClosedAction = Readonly<{ action_class: string; label: string; presentation: ActionPresentation }>;
type ClosedData = Readonly<Record<string, unknown>>;

const currentnessValues = new Set<Currentness>(["CURRENT", "STALE", "CONTRADICTORY", "MIXED_SOURCE", "MISSING_BINDING", "UNCERTAIN"]);

function closedTicketId(): string | undefined {
  const match = /^\/tickets\/([^/]+)\/closed\/?$/.exec(location.pathname);
  return match ? decodeURIComponent(match[1] ?? "") : undefined;
}

function text(data: ClosedData, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function currentness(value: unknown): Currentness {
  return typeof value === "string" && currentnessValues.has(value as Currentness) ? value as Currentness : "MISSING_BINDING";
}

function actions(data: ClosedData, projectionCurrentness: Currentness): readonly ClosedAction[] {
  const context = data["action_context"];
  if (projectionCurrentness !== "CURRENT" || typeof context !== "object" || context === null) return [];
  const record = context as Readonly<Record<string, unknown>>;
  if (currentness(record["currentness_ref"]) !== "CURRENT" || !Array.isArray(record["actions"])) return [];
  return record["actions"].flatMap((candidate): readonly ClosedAction[] => {
    if (typeof candidate !== "object" || candidate === null) return [];
    const item = candidate as Readonly<Record<string, unknown>>;
    const actionClass = typeof item["action_class"] === "string" ? item["action_class"] : undefined;
    const label = typeof item["label"] === "string" ? item["label"] : actionClass;
    const presentation = item["presentation"];
    if (!actionClass || !label || typeof presentation !== "object" || presentation === null) return [];
    const state = (presentation as Readonly<Record<string, unknown>>)["state"];
    if (state === "ENABLED") return [{ action_class: actionClass, label, presentation: { state } }];
    if (state === "HIDDEN") return [{ action_class: actionClass, label, presentation: { state } }];
    const reason = (presentation as Readonly<Record<string, unknown>>)["reason"];
    return state === "DISABLED" && typeof reason === "string" ? [{ action_class: actionClass, label, presentation: { state, reason } }] : [];
  });
}

export function ClosedTicketView() {
  const ticketId = closedTicketId();
  const [projection, setProjection] = useState<UiViewEnvelope>();
  const [failure, setFailure] = useState<string>();

  useEffect(() => {
    if (!ticketId) {
      setFailure("CLOSED_TICKET_CONTEXT_MISSING");
      return;
    }
    const client = createUiClient();
    void client.read(`/tickets/${encodeURIComponent(ticketId)}/concerns/closed`).then((result) => {
      if (result.view_id !== "UX-RS-12") throw new Error("CLOSED_PROJECTION_VIEW_MISMATCH");
      setProjection(result);
    }).catch((error: unknown) => setFailure(error instanceof Error ? error.message : "CLOSED_PROJECTION_UNAVAILABLE"));
  }, [ticketId]);

  const data = (projection?.data ?? {}) as ClosedData;
  const projectionCurrentness = currentness(projection?.currentness_ref);
  const availableActions = useMemo(() => actions(data, projectionCurrentness), [data, projectionCurrentness]);

  return <ViewFrame viewId="UX-RS-12" title="Closed Ticket / Correction / Successor">
    <CurrentnessBanner currentness={projectionCurrentness} />
    <p>Closed is irreversible. This view is a current server projection and does not create authority.</p>
    {failure ? <p role="alert">{failure}: post-closure controls are unavailable until authoritative context is restored.</p> : null}
    <dl>
      <dt>Ticket</dt><dd>{ticketId ?? "Not available from current source"}</dd>
      <dt>Purpose</dt><dd>{text(data, "purpose_ref") ?? "Not available from current source"}</dd>
      <dt>Domain</dt><dd>{text(data, "domain_ref") ?? "Not available from current source"}</dd>
      <dt>Closure / disposition lineage</dt><dd>{text(data, "closure_lineage_ref") ?? "Not available from current source"}</dd>
      <dt>Evidence lineage</dt><dd>{text(data, "evidence_lineage_ref") ?? "Not available from current source"}</dd>
      <dt>Correction / successor lineage</dt><dd>{text(data, "correction_successor_lineage_ref") ?? "Not available from current source"}</dd>
    </dl>
    {availableActions.length === 0 ? <p>No post-closure action is available without current authoritative action context.</p> : availableActions.map((action) => <ActionControl key={action.action_class} label={action.label} presentation={action.presentation} onInvoke={() => navigate(`/tickets/${encodeURIComponent(ticketId ?? "")}/action/${encodeURIComponent(action.action_class)}`)} />)}
  </ViewFrame>;
}
