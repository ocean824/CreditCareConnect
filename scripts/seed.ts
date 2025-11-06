import { db } from "../server/db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean);
  for (const email of admins) {
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (!existing) {
      await db.insert(users).values({
        email,
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        plan: "DIY"
      });
      console.log(`Seeded admin user: ${email}`);
    } else if (existing.role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, existing.id));
      console.log(`Promoted to admin: ${email}`);
    } else {
      console.log(`Admin already present: ${email}`);
    }
  }
  console.log("✅ Seed finished");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
