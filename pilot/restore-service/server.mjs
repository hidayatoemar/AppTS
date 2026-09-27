import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createMaterialScenario,
  createSiteAccessScenario,
  createHandoverScenario,
  applyEvent,
  projectConsole,
} from "./model.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const html = await readFile(join(here, "index.html"), "utf8");
const port = Number(process.env.PORT || 8080);

const factories = {
  material: createMaterialScenario,
  access: createSiteAccessScenario,
  handover: createHandoverScenario,
};
let activeScenario = "material";
let state = factories[activeScenario]();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/") return send(res, 200, html, "text/html; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/api/state") return json(res, 200, { scenario: activeScenario, ...projectConsole(state) });
    if (req.method === "POST" && url.pathname === "/api/next") {
      const eventId = state.allowedEventIds[state.nextEventIndex];
      if (!eventId) return json(res, 409, { error: "SCENARIO_COMPLETE" });
      state = applyEvent(state, eventId);
      return json(res, 200, { scenario: activeScenario, ...projectConsole(state) });
    }
    if (req.method === "POST" && url.pathname === "/api/reset") {
      state = factories[activeScenario]();
      return json(res, 200, { scenario: activeScenario, ...projectConsole(state) });
    }
    if (req.method === "POST" && url.pathname === "/api/scenario") {
      const body = await readJson(req);
      if (!body || typeof body.scenario !== "string" || !(body.scenario in factories)) return json(res, 400, { error: "INVALID_SCENARIO" });
      activeScenario = body.scenario;
      state = factories[activeScenario]();
      return json(res, 200, { scenario: activeScenario, ...projectConsole(state) });
    }
    return json(res, 404, { error: "NOT_FOUND" });
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AppTS HFP RESTORE vertical slice listening on http://127.0.0.1:${port}`);
});

function send(res, status, body, contentType) {
  res.statusCode = status;
  res.setHeader("content-type", contentType);
  res.setHeader("cache-control", "no-store");
  res.end(body);
}
function json(res, status, value) { send(res, status, JSON.stringify(value), "application/json; charset=utf-8"); }
async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}
