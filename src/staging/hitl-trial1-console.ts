export const HITL_TRIAL1_CONSOLE_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AppTS HITL Trial #1</title>
<style>
body{font-family:system-ui,sans-serif;margin:20px;max-width:1100px}header{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
section{border:1px solid #bbb;border-radius:8px;padding:12px;margin:12px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}
button,select{margin:4px;padding:6px 10px}.warn{font-weight:600}.muted{opacity:.7}.ok{font-weight:600}
</style>
</head>
<body>
<header>
  <strong>AppTS RESTORE_SERVICE — HITL Trial #1</strong>
  <span>synthetic only · loopback/SSH tunnel only</span>
  <button id="refresh">Refresh current truth</button>
</header>
<section>
  <h2>A. Situation / Responsibility / Evidence</h2>
  <label>Active Role / Acting Context <select id="role"></select></label>
  <pre id="regionA"></pre>
</section>
<section>
  <h2>B. Lawful Action / Command / Execution / Material Effect</h2>
  <div id="actionsB"></div>
  <pre id="regionB"></pre>
</section>
<section>
  <h2>C. Verification / Customer Verification / Closure</h2>
  <div id="actionsC"></div>
  <pre id="regionC"></pre>
</section>
<section>
  <h2>Non-authoritative latest POST /commands response</h2>
  <pre id="commandResponse" class="muted">(session state only)</pre>
</section>
<script>
let view = null;
let lastCommandResponse = null;

const $ = (id) => document.getElementById(id);
const json = (value) => JSON.stringify(value, null, 2);

async function loadView(selected) {
  const suffix = selected ? "?actingContextRef=" + encodeURIComponent(selected) : "";
  const response = await fetch("/trial-1/operator-view" + suffix, {cache:"no-store"});
  if (!response.ok) throw new Error("operator view unavailable: " + response.status);
  view = await response.json();
  render();
}

function render() {
  $("regionA").textContent = json({
    infrastructure:view.infrastructure,
    trial:view.trial,
    scope:view.scope,
    responsibility:view.responsibility,
    selectedActingContext:view.selectedActingContext,
    evidence:view.evidence,
    dependencies:view.dependencies,
    residualObligations:view.residualObligations
  });

  const role = $("role");
  const selected = view.roleContexts.find(x => x.selected)?.actingContextRef;
  role.innerHTML = "";
  for (const item of view.roleContexts) {
    const option = document.createElement("option");
    option.value = item.actingContextRef;
    option.textContent = item.roleRef + " · " + item.authorityBasisRef;
    option.selected = item.actingContextRef === selected;
    role.appendChild(option);
  }

  $("regionB").textContent = json({
    actions:{"RS-A-022":view.actions["RS-A-022"]},
    execution:view.latest.execution ?? null,
    materialEffects:view.latest.materialEffects
  });
  $("regionC").textContent = json({
    actions:{
      "RS-A-012":view.actions["RS-A-012"],
      "RS-A-013":view.actions["RS-A-013"],
      "RS-A-014":view.actions["RS-A-014"],
      "RS-A-015":view.actions["RS-A-015"]
    },
    verification:view.verification,
    verificationClosure:view.latest.verificationClosure ?? null,
    warnings:view.warnings
  });
  $("commandResponse").textContent = lastCommandResponse ? json(lastCommandResponse) : "(session state only)";
  renderButtons("actionsB", ["RS-A-022"]);
  renderButtons("actionsC", ["RS-A-012","RS-A-013","RS-A-015"]);
}

function renderButtons(containerId, actions) {
  const container = $(containerId);
  container.innerHTML = "";
  for (const actionId of actions) {
    const projection = view.actions[actionId];
    if (!projection || projection.mode !== "HUMAN_ONLY") continue;
    for (const intent of projection.allowedIntentRefs) {
      const button = document.createElement("button");
      button.textContent = actionId + " · " + intent;
      button.disabled = !projection.projection.available;
      button.onclick = () => submit(actionId, intent);
      container.appendChild(button);
    }
  }
  if (containerId === "actionsC") {
    const a14 = document.createElement("span");
    a14.className = "muted";
    a14.textContent = "RS-A-014 is deterministic machine evaluation; no human submit control.";
    container.appendChild(a14);
  }
}

async function submit(actionId, intent) {
  const selected = view.roleContexts.find(x => x.selected);
  if (!selected) throw new Error("no selected acting context");
  const commandId = "CMD-HITL1-" + actionId + "-" + crypto.randomUUID();
  const envelope = {
    commandId,
    actionId,
    purposeRef:{
      purpose:"RESTORE_SERVICE",
      situationId:view.scope.scopeRef.situationId,
      compositionInstanceId:view.trial.scenarioId,
      startedFromBasisRef:view.evidence.evidenceRefs[0]
    },
    scopeRef:view.scope.scopeRef,
    requestedByActorOrMachineRef:view.trial.personRef,
    actingContextRef:selected.actingContextRef,
    expectedInputVersion:view.scope.version,
    requestTime:new Date().toISOString(),
    payloadRef:intent,
    evidenceRefs:view.evidence.evidenceRefs
  };
  const response = await fetch("/commands",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(envelope)
  });
  lastCommandResponse = {httpStatus:response.status, ...(await response.json())};
  await loadView(selected.actingContextRef);
}

$("role").addEventListener("change", event => loadView(event.target.value));
$("refresh").addEventListener("click", () => loadView($("role").value || undefined));
loadView().catch(error => {
  document.body.insertAdjacentHTML("beforeend","<pre class='warn'></pre>");
  document.querySelector("pre.warn").textContent = String(error);
});
</script>
</body>
</html>`;
