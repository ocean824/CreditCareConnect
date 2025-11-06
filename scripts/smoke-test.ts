import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  // DB connectivity
  await db.execute(sql`select 1`);
  console.log("✅ DB OK");

  console.log("✅ Smoke tests passed");
}

run().catch((e) => {
  console.error("❌ Smoke test failed:", e);
  process.exit(1);
});
