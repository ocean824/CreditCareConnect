import bcrypt from "bcrypt";
import { db } from "./db";
import { adminCredentials } from "@shared/schema";
import { eq } from "drizzle-orm";

async function updateAdminPassword() {
  const newPassword = "CCPros10miL$$";
  const username = "admin";

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await db
      .update(adminCredentials)
      .set({ passwordHash: hashedPassword })
      .where(eq(adminCredentials.username, username))
      .returning();

    if (result.length > 0) {
      console.log(`✅ Successfully updated password for admin user: ${username}`);
      console.log(`Email: ${result[0].email}`);
    } else {
      console.log(`❌ Admin user not found: ${username}`);
      console.log("Creating admin account...");
      
      await db.insert(adminCredentials).values({
        username,
        email: "admin@personalcreditpros.com",
        passwordHash: hashedPassword,
      });
      
      console.log(`✅ Admin account created successfully`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating admin password:", error);
    process.exit(1);
  }
}

updateAdminPassword();
