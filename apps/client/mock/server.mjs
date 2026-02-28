import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 4173);
const root = process.cwd();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const resolvePath = (urlPath) => {
  if (urlPath === "/") {
    return join(root, "apps/client/mock/index.html");
  }
  return join(root, normalize(urlPath));
};

createServer(async (req, res) => {
  try {
    const reqPath = new URL(req.url, `http://${req.headers.host}`).pathname;
    const filePath = resolvePath(reqPath);
    const content = await readFile(filePath);
    const type = mime[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Tong mock UI running at http://0.0.0.0:${port}`);
});
