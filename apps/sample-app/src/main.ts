import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";

const port = z.coerce.number().int().min(1).max(65535).catch(8080).parse(process.env.PORT);

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/health") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sample App</title>
  </head>
  <body style="font-family: ui-sans-serif, system-ui; padding: 24px;">
    <h1>Sample App</h1>
    <p>If you can see this page, the deployed container is reachable.</p>
    <p><a href="health">/health</a></p>
  </body>
</html>`);
});

server.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`sample-app listening on :${port}`);
});

