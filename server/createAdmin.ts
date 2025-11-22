import bcrypt from "bcrypt";
import { db } from "./db";
import { adminCredentials } from "@shared/schema";

async function createAdminUser() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const email = process.env.ADMIN_EMAIL || "admin@personalcreditpros.com";

  console.log(`Creating admin user: ${username}`);
  
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const [admin] = await db
      .insert(adminCredentials)
      .values({
        username,
        passwordHash,
        email,
      })
      .returning();

    console.log("✅ Admin user created successfully!");
    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);
    console.log("\n⚠️  Please change the password after first login!");
    
    process.exit(0);
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  }
}

createAdminUser();
