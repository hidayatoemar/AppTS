const REPLAY_BASENAME = "/tools/td-pre-001-governed-replay.mjs";
const SHIM_URL = "dt-trial-pg:shim";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "pg" && context.parentURL?.includes(REPLAY_BASENAME)) {
    return { url: SHIM_URL, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url !== SHIM_URL) return nextLoad(url, context);

  return {
    format: "module",
    shortCircuit: true,
    source: `
import { createRequire } from "node:module";
const require = createRequire("/workspace/package.json");
const realPg = require("/workspace/node_modules/pg");
const required = ["DT_TRIAL_PGHOST", "DT_TRIAL_PGPORT", "DT_TRIAL_PGUSER", "DT_TRIAL_PGDATABASE", "DT_TRIAL_PGPASSWORD"];
for (const key of required) {
  if (!process.env[key]) throw new Error("DT_TRIAL_DB_ENVELOPE_MISSING_" + key);
}
export class Pool extends realPg.Pool {
  constructor(config = {}) {
    const exactProducerEnvelope = config.host === "127.0.0.1" && Number(config.port) === 55432 && config.user === "postgres" && config.database === "postgres";
    if (!exactProducerEnvelope) throw new Error("DT_TRIAL_UNEXPECTED_PRODUCER_DB_ENVELOPE");
    super({
      ...config,
      host: process.env.DT_TRIAL_PGHOST,
      port: Number(process.env.DT_TRIAL_PGPORT),
      user: process.env.DT_TRIAL_PGUSER,
      database: process.env.DT_TRIAL_PGDATABASE,
      password: process.env.DT_TRIAL_PGPASSWORD,
    });
  }
}
`;
  };
}
