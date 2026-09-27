import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTORS,
  applyEvent,
  createInitialState,
  project,
  recordRoutineActivity,
} from './model.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8090);
const bind = process.env.BIND || '127.0.0.1';
const MAX_BODY = 32 * 1024;
let state = createInitialState();

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url || '/', 'http://' + host);

    if (req.method === 'GET' && url.pathname === '/api/state') {
      const actor = url.searchParams.get('actor') || ACTORS.BUDI.ref;
      return json(res, 200, { actors: ACTORS, projection: project(state, actor) });
    }

    if (req.method === 'POST' && url.pathname === '/api/apply') {
      const body = await readJson(req);
      const eventId = requiredString(body.eventId, 'eventId');
      const actorRef = requiredString(body.actorRef, 'actorRef');
      const outcome = applyEvent(state, eventId, actorRef);
      if (outcome.result.kind === 'APPLIED') state = outcome.state;
      return json(res, outcome.result.kind === 'APPLIED' ? 200 : 409, {
        result: outcome.result,
        actors: ACTORS,
        projection: project(state, actorRef),
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/activity') {
      const body = await readJson(req);
      const actorRef = requiredString(body.actorRef, 'actorRef');
      const note = typeof body.note === 'string' && body.note.trim()
        ? body.note.trim()
        : 'Follow-up / checking activity';
      const outcome = recordRoutineActivity(state, actorRef, note);
      if (outcome.result.kind === 'NO_TRANSITION') state = outcome.state;
      return json(res, 200, {
        result: outcome.result,
        actors: ACTORS,
        projection: project(state, actorRef),
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/reset') {
      state = createInitialState();
      return json(res, 200, {
        result: { kind: 'RESET' },
        actors: ACTORS,
        projection: project(state, ACTORS.BUDI.ref),
      });
    }

    if (req.method === 'GET') return serveStatic(url.pathname, res);
    return json(res, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    const status = error && error.code === 'BAD_REQUEST' ? 400 : 500;
    return json(res, status, {
      error: status === 400 ? error.message : 'PILOT_RUNTIME_FAILURE',
    });
  }
});

server.listen(port, bind, () => {
  console.log('AppTS HFP RESTORE pilot listening on http://' + bind + ':' + port);
});

async function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, '');
  if (!['index.html'].includes(safe)) return json(res, 404, { error: 'NOT_FOUND' });
  const body = await readFile(join(root, safe));
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

async function readJson(req) {
  const type = String(req.headers['content-type'] || '');
  if (!/^application\/json(?:\s*;|$)/i.test(type)) throw bad('APPLICATION_JSON_REQUIRED');
  return await new Promise((resolve, reject) => {
    let text = '';
    let bytes = 0;
    req.setEncoding('utf8');
    req.on('data', chunk => {
      bytes += Buffer.byteLength(chunk, 'utf8');
      if (bytes > MAX_BODY) {
        reject(bad('BODY_TOO_LARGE'));
        req.destroy();
        return;
      }
      text += chunk;
    });
    req.on('end', () => {
      try { resolve(JSON.parse(text || '{}')); }
      catch { reject(bad('MALFORMED_JSON')); }
    });
    req.on('error', reject);
  });
}

function requiredString(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw bad('INVALID_' + name);
  return value.trim();
}

function bad(message) {
  const error = new Error(message);
  error.code = 'BAD_REQUEST';
  return error;
}

function json(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(payload));
}
