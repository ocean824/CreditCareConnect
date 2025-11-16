import type { Express } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";

export function registerObservability(app: Express) {
  // Liveness (process ok)
  app.get("/healthz", (_req, res) => res.status(200).send("ok"));

  // Readiness (DB reachable)
  app.get("/readyz", async (_req, res) => {
    try {
      await db.execute(sql`select 1`);
      res.status(200).send("ready");
    } catch {
      res.status(503).send("not-ready");
    }
  });
}
