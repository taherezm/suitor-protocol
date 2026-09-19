// Local verification only. GitHub Pages serves out/ directly without this script.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../out/", import.meta.url));
const prefix = "/suitor-protocol";
const port = Number(process.env.PORT ?? 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

await stat(resolve(root, "index.html")).catch(() => {
  throw new Error("Static export missing. Run pnpm build before pnpm preview.");
});

createServer(async (request, response) => {
  async function notFound() {
    response.writeHead(404, { "Content-Type": types[".html"] });
    response.end(
      request.method === "HEAD"
        ? undefined
        : await readFile(resolve(root, "404.html")),
    );
  }

  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }
    const url = new URL(request.url ?? "/", "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === "/" || pathname === prefix) {
      response.writeHead(302, { Location: `${prefix}/${url.search}` });
      response.end();
      return;
    }
    if (!pathname.startsWith(`${prefix}/`)) return await notFound();

    let path = resolve(root, `.${pathname.slice(prefix.length)}`);
    if (path !== resolve(root) && !path.startsWith(resolve(root) + sep))
      return await notFound();
    let info = await stat(path).catch(() => null);
    if (info?.isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        response.writeHead(301, { Location: `${url.pathname}/${url.search}` });
        response.end();
        return;
      }
      path = resolve(path, "index.html");
      info = await stat(path).catch(() => null);
    }
    if (!info?.isFile()) return await notFound();
    response.writeHead(200, {
      "Content-Type": types[extname(path)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : await readFile(path));
  } catch {
    if (!response.headersSent) response.writeHead(400);
    response.end();
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Static export: http://127.0.0.1:${port}${prefix}/`);
});
