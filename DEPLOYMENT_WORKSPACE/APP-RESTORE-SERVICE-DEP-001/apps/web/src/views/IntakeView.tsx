import { useEffect, useState } from "react";
import { createUiClient, type UiViewEnvelope } from "../api.ts";
import { CurrentnessBanner, type Currentness } from "../components/CurrentnessBanner.tsx";
import { ViewFrame } from "../components/ViewFrame.tsx";

type IntakeProjection = Readonly<Record<string, unknown>>;
const currentnessValues = new Set<Currentness>(["CURRENT", "STALE", "CONTRADICTORY", "MIXED_SOURCE", "MISSING_BINDING", "UNCERTAIN"]);
function currentness(value: unknown): Currentness { return typeof value === "string" && currentnessValues.has(value as Currentness) ? value as Currentness : "MISSING_BINDING"; }
function text(data: IntakeProjection, key: string): string { const value = data[key]; return typeof value === "string" && value.length > 0 ? value : "Not available from current source"; }
function caseIdFromPath(): string | undefined { const match = /^\/intake\/([^/]+)\/?$/.exec(location.pathname); return match ? decodeURIComponent(match[1] ?? "") : undefined; }

export function IntakeView() {
  const subjectRef = caseIdFromPath();
  const [projection, setProjection] = useState<UiViewEnvelope>();
  const [failure, setFailure] = useState<string>();
  useEffect(() => {
    const client = createUiClient();
    const path = subjectRef === undefined ? "/intake" : `/intake/${encodeURIComponent(subjectRef)}`;
    void client.read(path).then((result) => {
      if (result.view_id !== "UX-RS-02") throw new Error("INTAKE_PROJECTION_VIEW_MISMATCH");
      setProjection(result);
    }).catch((error: unknown) => setFailure(error instanceof Error ? error.message : "INTAKE_PROJECTION_UNAVAILABLE"));
  }, [subjectRef]);

  const rawCases = projection?.data["cases"];
  const cases = Array.isArray(rawCases) ? rawCases.filter((item): item is IntakeProjection => typeof item === "object" && item !== null) : [];
  const projectionCurrentness = currentness(projection?.currentness_ref);

  return <ViewFrame viewId="UX-RS-02" title="Pre-Ticket Intake and Admission">
    <CurrentnessBanner currentness={projectionCurrentness} />
    <p>A pre-Ticket case is not a Ticket. Formation remains owner-controlled and fail-closed.</p>
    {failure ? <p role="alert">{failure}: current intake projection is unavailable.</p> : null}
    {cases.length === 0 ? <p>No pre-Ticket case is available from the current server projection.</p> : <ul>{cases.map((item, index) => <li key={text(item, "case_id") === "Not available from current source" ? String(index) : text(item, "case_id")}>
      <dl>
        <dt>Case</dt><dd>{text(item, "case_id")}</dd>
        <dt>Status</dt><dd>{text(item, "case_status_ref")}</dd>
        <dt>Assessment</dt><dd>{text(item, "assessment_result")}</dd>
        <dt>Completeness</dt><dd>{text(item, "completeness_result")} / {text(item, "completeness_reason")}</dd>
        <dt>Decision</dt><dd>{text(item, "decision_code")}</dd>
        <dt>Currentness</dt><dd>{text(item, "currentness_ref")}</dd>
      </dl>
    </li>)}</ul>}
  </ViewFrame>;
}
