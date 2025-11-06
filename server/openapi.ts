import type { Express } from "express";
import fs from "fs";
import path from "path";
import YAML from "yaml";

/** Serve OpenAPI JSON & ReDoc */
export function registerOpenApi(app: Express) {
  const specPath = path.resolve(import.meta.dirname, "openapi.yml");
  const raw = fs.readFileSync(specPath, "utf8");
  const doc = YAML.parse(raw);

  app.get("/api/json", (_req, res) => {
    res.json(doc);
  });

  app.get("/api/docs", (_req, res) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(`<!doctype html>
<html>
  <head>
    <title>API Docs</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <style>body,html{margin:0;height:100%}</style>
  </head>
  <body>
    <redoc spec-url="/api/json"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`);
  });
}
