import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset DB in production.");
  }
  await db.execute(sql`drop schema public cascade; create schema public;`);
  console.log("🔄 DB schema reset");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
