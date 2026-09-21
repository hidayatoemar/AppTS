import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const port = Number(process.env.PORT || 8088);
const types = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml"};

const server = http.createServer(async (req,res)=>{
  try{
    const raw = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = raw === "/" ? "index.html" : raw.replace(/^\/+/, "");
    const safe = normalize(rel).replace(/^(\.\.[/\\])+/, "");
    const path = join(root, safe);
    const info = await stat(path);
    if(!info.isFile()) throw new Error("not file");
    const body = await readFile(path);
    res.writeHead(200,{"content-type":types[extname(path)] || "application/octet-stream","cache-control":"no-store","x-content-type-options":"nosniff"});
    res.end(body);
  }catch{
    res.writeHead(404,{"content-type":"text/plain; charset=utf-8"});
    res.end("Not found");
  }
});
server.listen(port,"0.0.0.0",()=>console.log(`AppTS mockup listening on 0.0.0.0:${port}`));
