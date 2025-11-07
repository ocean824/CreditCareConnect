import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

async function checkEndpoint(path: string, expectedStatus = 200) {
  try {
    const res = await fetch(`${BASE_URL}${path}`);
    if (res.status !== expectedStatus) {
      throw new Error(`Expected ${expectedStatus}, got ${res.status}`);
    }
    console.log(`✅ ${path} OK (${res.status})`);
    return res;
  } catch (e: any) {
    console.error(`❌ ${path} FAIL: ${e.message}`);
    throw e;
  }
}

async function run() {
  console.log("Running smoke tests...\n");

  // 1. DB connectivity
  await db.execute(sql`select 1`);
  console.log("✅ DB OK\n");

  // 2. Health endpoints
  console.log("Testing observability endpoints:");
  await checkEndpoint("/healthz");
  await checkEndpoint("/readyz");
  console.log();

  // 3. Documentation endpoints
  console.log("Testing documentation endpoints:");
  const jsonRes = await checkEndpoint("/api/json");
  const json = await jsonRes.json();
  if (!json.openapi) {
    throw new Error("/api/json missing openapi field");
  }
  console.log(`   OpenAPI version: ${json.openapi}`);
  
  const docsRes = await checkEndpoint("/api/docs");
  const html = await docsRes.text();
  if (!html.includes("redoc")) {
    throw new Error("/api/docs missing ReDoc script");
  }
  console.log();

  console.log("✅ All smoke tests passed");
}

run().catch((e) => {
  console.error("\n❌ Smoke test failed:", e.message);
  process.exit(1);
});
