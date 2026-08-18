import { useEffect, useState } from "react";
import { createUiClient, type UiViewEnvelope } from "../api.ts";
import { CurrentnessBanner, type Currentness } from "../components/CurrentnessBanner.tsx";
import { ViewFrame } from "../components/ViewFrame.tsx";

const currentnessValues = new Set<Currentness>(["CURRENT", "STALE", "CONTRADICTORY", "MIXED_SOURCE", "MISSING_BINDING", "UNCERTAIN"]);

type WorkItem = Readonly<Record<string, unknown>>;

function currentness(value: unknown): Currentness {
  return typeof value === "string" && currentnessValues.has(value as Currentness) ? value as Currentness : "MISSING_BINDING";
}

function items(data: Readonly<Record<string, unknown>>): readonly WorkItem[] {
  const value = data["items"];
  return Array.isArray(value) ? value.filter((candidate): candidate is WorkItem => typeof candidate === "object" && candidate !== null) : [];
}

function text(item: WorkItem, key: string): string | undefined {
  const value = item[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function label(item: WorkItem): string {
  return text(item, "purpose_ref") ?? text(item, "domain_ref") ?? "details pending authoritative projection";
}

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

  const data = (projection?.data ?? {}) as Readonly<Record<string, unknown>>;
  const projectionCurrentness = currentness(projection?.currentness_ref);
  const queueItems = items(data);

  return <ViewFrame viewId="UX-RS-01" title="Role-Scoped Work Queue">
    <CurrentnessBanner currentness={projectionCurrentness} />
    <p>This queue is a current server projection and does not create authority.</p>
    {failure ? <p role="alert">{failure}: the work queue is unavailable until authoritative projection is restored.</p> : null}
    {!projection ? null : queueItems.length === 0 ? <p>No work item is currently assigned to this role.</p> : <ul>
      {queueItems.map((item, index) => <li key={index}>
        {text(item, "ticket_ref") ?? "Work item"} — {label(item)}
        {text(item, "status_ref") ? ` (${text(item, "status_ref")})` : null}
      </li>)}
    </ul>}
  </ViewFrame>;
}
